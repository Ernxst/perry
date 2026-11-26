use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Sel};
use objc2::{define_class, msg_send, AnyThread, DefinedClass};
use objc2_app_kit::{
    NSLayoutAttribute, NSStackView, NSSwitch, NSTextField, NSUserInterfaceLayoutOrientation, NSView,
};
use objc2_foundation::{MainThreadMarker, NSObject, NSString};
use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    /// Map from target object address to closure pointer (f64 NaN-boxed)
    static TOGGLE_CALLBACKS: RefCell<HashMap<usize, f64>> = RefCell::new(HashMap::new());
    /// Map from toggle widget handle -> NSSwitch view for two-way binding
    static TOGGLE_SWITCHES: RefCell<HashMap<i64, Retained<NSView>>> = RefCell::new(HashMap::new());
}

pub(crate) fn scan_macos_toggle_gc_roots(visitor: &mut perry_ffi::GcRootVisitor<'_>) {
    TOGGLE_CALLBACKS.with(|callbacks| {
        for callback in callbacks.borrow_mut().values_mut() {
            visitor.visit_nanbox_f64_slot(callback);
        }
    });
}

// TAG_TRUE and TAG_FALSE from perry-runtime NaN-boxing
const TAG_TRUE: u64 = 0x7FFC_0000_0000_0004;
const TAG_FALSE: u64 = 0x7FFC_0000_0000_0003;

extern "C" {
    fn js_closure_call1(closure: *const u8, this: perry_ffi::JsThis, arg: f64) -> f64;
    fn js_nanbox_get_pointer(value: f64) -> i64;
}

pub struct PerryToggleTargetIvars {
    callback_key: std::cell::Cell<usize>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "PerryToggleTarget"]
    #[ivars = PerryToggleTargetIvars]
    pub struct PerryToggleTarget;

    impl PerryToggleTarget {
        #[unsafe(method(toggleChanged:))]
        fn toggle_changed(&self, sender: &AnyObject) {
            let key = self.ivars().callback_key.get();
            crate::catch_callback_panic("toggle callback", std::panic::AssertUnwindSafe(|| {
                // Copy the closure out and release the borrow before calling
                // into JS: the callback may create another widget of this kind
                // (which inserts into this map) or trigger a GC root scan
                // (which borrows it mutably) — either panicked with
                // "RefCell already borrowed" while the borrow was held.
                let callback = TOGGLE_CALLBACKS.with(|cbs| cbs.borrow().get(&key).copied());
                if let Some(closure_f64) = callback {
                    let state: i64 = unsafe { msg_send![sender, state] };
                    let value = if state != 0 {
                        f64::from_bits(TAG_TRUE)
                    } else {
                        f64::from_bits(TAG_FALSE)
                    };

                    let closure_ptr = unsafe { js_nanbox_get_pointer(closure_f64) };
                    unsafe {
                        js_closure_call1(closure_ptr as *const u8, perry_ffi::JsThis::UNDEFINED, value);
                    }
                }
            }));
        }
    }
);

impl PerryToggleTarget {
    fn new() -> Retained<Self> {
        let this = Self::alloc().set_ivars(PerryToggleTargetIvars {
            callback_key: std::cell::Cell::new(0),
        });
        unsafe { msg_send![super(this), init] }
    }
}

/// Extract a &str from a *const StringHeader pointer.
use perry_ffi::copy_string_from_raw as str_from_header;

/// Set the on/off state of an existing toggle widget.
/// `on` is 0 for off, non-zero for on.
pub fn set_state(handle: i64, on: i64) {
    TOGGLE_SWITCHES.with(|switches| {
        if let Some(switch_view) = switches.borrow().get(&handle) {
            unsafe {
                let switch: &NSSwitch = &*(Retained::as_ptr(switch_view) as *const NSSwitch);
                let state: i64 = if on != 0 { 1 } else { 0 };
                let _: () = msg_send![switch, setState: state];
            }
        }
    });
}

/// Draw a Toggle as a switch (0), a checkbox (1) or a radio button (2). A checkbox or radio
/// button sits before the Toggle's label, as on the web, and keeps the switch's state, target,
/// action and enabled state.
pub fn set_style(handle: i64, style: f64) {
    let Some(current) = switch(handle) else { return };
    let Some(container) = super::get_widget(handle) else { return };
    let Some(stack) = container.downcast_ref::<NSStackView>() else { return };
    let mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");
    let style = style as i64;
    unsafe {
        let next: Retained<NSView> = if style == 1 || style == 2 {
            // NSButtonTypeSwitch is AppKit's checkbox; NSButtonTypeRadio its radio button.
            let button_type: u64 = if style == 1 { 3 } else { 4 };
            let button = objc2_app_kit::NSButton::new(mtm);
            let _: () = msg_send![&*button, setButtonType: button_type];
            button.setTitle(&NSString::from_str(""));
            Retained::cast_unchecked(button)
        } else {
            Retained::cast_unchecked(NSSwitch::new(mtm))
        };
        let state: i64 = msg_send![&*current, state];
        let enabled: bool = msg_send![&*current, isEnabled];
        let target: *mut AnyObject = msg_send![&*current, target];
        let action: Option<Sel> = msg_send![&*current, action];
        let _: () = msg_send![&*next, setState: state];
        let _: () = msg_send![&*next, setEnabled: enabled];
        let _: () = msg_send![&*next, setTarget: target];
        let _: () = msg_send![&*next, setAction: action];
        stack.removeView(&current);
        current.removeFromSuperview();
        // An empty caption would still take its share of the stack's spacing beside the button.
        for view in stack.arrangedSubviews() {
            if let Some(label) = view.downcast_ref::<NSTextField>() {
                label.setHidden(label.stringValue().length() == 0);
            }
        }
        if style == 1 || style == 2 {
            stack.insertArrangedSubview_atIndex(&next, 0);
        } else {
            stack.addArrangedSubview(&next);
        }
        TOGGLE_SWITCHES.with(|switches| switches.borrow_mut().insert(handle, next));
    }
}

/// The switch inside a Toggle's container.
pub(crate) fn switch(handle: i64) -> Option<Retained<NSView>> {
    TOGGLE_SWITCHES.with(|switches| switches.borrow().get(&handle).cloned())
}

/// Create an NSSwitch with a label and onChange callback.
/// Returns a widget handle for an HStack containing the label and switch.
pub fn create(label_ptr: *const u8, on_change: f64) -> i64 {
    let label = unsafe { str_from_header(label_ptr) };

    let mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");

    unsafe {
        // Create label
        let ns_label = NSString::from_str(&label);
        let text_field = NSTextField::labelWithString(&ns_label, mtm);

        // Create NSSwitch
        let switch = NSSwitch::new(mtm);

        // Create target for action callback
        let target = PerryToggleTarget::new();
        let target_addr = Retained::as_ptr(&target) as usize;
        target.ivars().callback_key.set(target_addr);

        TOGGLE_CALLBACKS.with(|cbs| {
            cbs.borrow_mut().insert(target_addr, on_change);
        });

        let sel = Sel::register(c"toggleChanged:");
        switch.setTarget(Some(&target));
        switch.setAction(Some(sel));

        std::mem::forget(target);

        // Create HStack containing label + switch
        let stack = NSStackView::new(mtm);
        stack.setOrientation(NSUserInterfaceLayoutOrientation::Horizontal);
        stack.setSpacing(8.0);
        stack.setAlignment(NSLayoutAttribute::CenterY);

        let text_view: Retained<NSView> = Retained::cast_unchecked(text_field);
        let switch_view: Retained<NSView> = Retained::cast_unchecked(switch);

        stack.addArrangedSubview(&text_view);
        stack.addArrangedSubview(&switch_view);

        let view: Retained<NSView> = Retained::cast_unchecked(stack);
        let handle = super::register_widget(view);

        // Store the NSSwitch reference for two-way binding (set_state)
        TOGGLE_SWITCHES.with(|switches| {
            switches.borrow_mut().insert(handle, switch_view.clone());
        });

        #[cfg(feature = "geisterhand")]
        {
            extern "C" {
                fn perry_geisterhand_register(h: i64, wt: u8, ck: u8, cb: f64, lbl: *const u8);
            }
            perry_geisterhand_register(handle, 3, 1, on_change, label_ptr);
        }

        handle
    }
}
