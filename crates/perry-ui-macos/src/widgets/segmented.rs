//! `SegmentedControl`: an `NSSegmentedControl` that selects one segment at a time.

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Sel};
use objc2::{define_class, msg_send, AnyThread, DefinedClass, MainThreadOnly};
use objc2_app_kit::{NSSegmentedControl, NSView};
use objc2_foundation::{MainThreadMarker, NSObject, NSString};
use std::cell::RefCell;
use std::collections::HashMap;

/// `NSSegmentSwitchTrackingSelectOne`.
const TRACKING_SELECT_ONE: usize = 0;

thread_local! {
    static CALLBACKS: RefCell<HashMap<i64, f64>> = RefCell::new(HashMap::new());
}

pub(crate) fn scan_macos_segmented_gc_roots(visitor: &mut perry_ffi::GcRootVisitor<'_>) {
    CALLBACKS.with(|callbacks| {
        for callback in callbacks.borrow_mut().values_mut() {
            visitor.visit_nanbox_f64_slot(callback);
        }
    });
}

extern "C" {
    fn js_closure_call1(closure: *const u8, this: perry_ffi::JsThis, arg: f64) -> f64;
    fn js_nanbox_get_pointer(value: f64) -> i64;
}

pub struct PerrySegmentedTargetIvars {
    pub handle: std::cell::Cell<i64>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "PerrySegmentedTarget"]
    #[ivars = PerrySegmentedTargetIvars]
    pub struct PerrySegmentedTarget;

    impl PerrySegmentedTarget {
        #[unsafe(method(segmentChanged:))]
        fn segment_changed(&self, _sender: &AnyObject) {
            let handle = self.ivars().handle.get();
            crate::catch_callback_panic("segmented control callback", std::panic::AssertUnwindSafe(|| {
                // The borrow is released before the call, which can register
                // another control or run a GC scan of the table.
                let callback = CALLBACKS.with(|cbs| cbs.borrow().get(&handle).copied());
                let (Some(callback), Some(view)) = (callback, super::get_widget(handle)) else {
                    return;
                };
                let index: isize = unsafe { msg_send![&*view, selectedSegment] };
                let closure_ptr = unsafe { js_nanbox_get_pointer(callback) } as *const u8;
                unsafe {
                    js_closure_call1(closure_ptr, perry_ffi::JsThis::UNDEFINED, index as f64);
                }
            }));
        }
    }
);

impl PerrySegmentedTarget {
    fn new(handle: i64) -> Retained<Self> {
        let this = Self::alloc().set_ivars(PerrySegmentedTargetIvars {
            handle: std::cell::Cell::new(handle),
        });
        unsafe { msg_send![super(this), init] }
    }
}

/// Create an empty control that calls `on_change` with the index the user selects.
pub fn create(on_change: f64) -> i64 {
    let mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");
    unsafe {
        let control: Retained<NSSegmentedControl> = msg_send![NSSegmentedControl::alloc(mtm), init];
        let _: () = msg_send![&*control, setTrackingMode: TRACKING_SELECT_ONE];
        let view: Retained<NSView> = Retained::cast_unchecked(control);
        let handle = super::register_widget(view);
        CALLBACKS.with(|cbs| {
            cbs.borrow_mut().insert(handle, on_change);
        });
        let target = PerrySegmentedTarget::new(handle);
        let view = super::get_widget(handle).unwrap();
        let _: () = msg_send![&*view, setTarget: &*target];
        let _: () = msg_send![&*view, setAction: Sel::register(c"segmentChanged:")];
        // The control holds its target weakly.
        std::mem::forget(target);
        handle
    }
}

/// Append a segment labelled `title`.
pub fn add_segment(handle: i64, title_ptr: *const u8) {
    let title = unsafe { perry_ffi::copy_string_from_raw(title_ptr) };
    let Some(view) = super::get_widget(handle) else {
        return;
    };
    unsafe {
        let count: isize = msg_send![&*view, segmentCount];
        let _: () = msg_send![&*view, setSegmentCount: count + 1];
        let _: () = msg_send![&*view, setLabel: &*NSString::from_str(&title), forSegment: count];
        let _: () = msg_send![&*view, sizeToFit];
    }
}

/// Remove every segment.
pub fn remove_all(handle: i64) {
    if let Some(view) = super::get_widget(handle) {
        unsafe {
            let _: () = msg_send![&*view, setSegmentCount: 0isize];
        }
    }
}

/// Select the segment at `index`, or none when it's out of range.
pub fn set_selected(handle: i64, index: i64) {
    let Some(view) = super::get_widget(handle) else {
        return;
    };
    unsafe {
        let count: isize = msg_send![&*view, segmentCount];
        if index >= 0 && (index as isize) < count {
            let _: () = msg_send![&*view, setSelectedSegment: index as isize];
        } else {
            for segment in 0..count {
                let _: () = msg_send![&*view, setSelected: false, forSegment: segment];
            }
        }
    }
}

/// Enable or disable the segment at `index`.
pub fn set_segment_enabled(handle: i64, index: i64, enabled: bool) {
    let Some(view) = super::get_widget(handle) else {
        return;
    };
    unsafe {
        let count: isize = msg_send![&*view, segmentCount];
        if index >= 0 && (index as isize) < count {
            let _: () = msg_send![&*view, setEnabled: enabled, forSegment: index as isize];
        }
    }
}
