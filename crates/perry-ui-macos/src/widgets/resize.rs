use objc2::msg_send;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_foundation::NSString;
use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};

extern "C" {
    fn js_closure_call2(closure: *const u8, this: perry_ffi::JsThis, a: f64, b: f64) -> f64;
    fn js_nanbox_get_pointer(value: f64) -> i64;
    static _dispatch_main_q: std::ffi::c_void;
    fn dispatch_async_f(
        queue: *const std::ffi::c_void,
        context: *mut std::ffi::c_void,
        work: unsafe extern "C" fn(*mut std::ffi::c_void),
    );
}

thread_local! {
    static CALLBACKS: RefCell<HashMap<i64, f64>> = RefCell::new(HashMap::new());
    /// Widgets with a frame-change observer. The observer outlives a cleared
    /// callback, so it is added once per widget.
    static OBSERVED: RefCell<HashSet<i64>> = RefCell::new(HashSet::new());
    static REPORTED: RefCell<HashMap<i64, (f64, f64)>> = RefCell::new(HashMap::new());
    static FLUSH_SCHEDULED: Cell<bool> = const { Cell::new(false) };
}

pub(crate) fn scan_macos_resize_gc_roots(visitor: &mut perry_ffi::GcRootVisitor<'_>) {
    CALLBACKS.with(|callbacks| {
        for callback in callbacks.borrow_mut().values_mut() {
            visitor.visit_nanbox_f64_slot(callback);
        }
    });
}

/// Call `callback` with the widget's `(width, height)` in points once its
/// current size is known and again whenever the size changes. Calls come
/// after layout has finished, on a later turn of the main queue, so a
/// callback that changes the layout doesn't run inside it. Replaces any
/// earlier callback on the widget.
pub fn set_on_resize(handle: i64, callback: f64) {
    let Some(view) = super::get_widget(handle) else {
        return;
    };
    CALLBACKS.with(|c| c.borrow_mut().insert(handle, callback));
    REPORTED.with(|r| r.borrow_mut().remove(&handle));
    let first = OBSERVED.with(|o| o.borrow_mut().insert(handle));
    if first {
        unsafe {
            let _: () = msg_send![&*view, setPostsFrameChangedNotifications: true];
            let center: Retained<AnyObject> =
                msg_send![objc2::class!(NSNotificationCenter), defaultCenter];
            let name = NSString::from_str("NSViewFrameDidChangeNotification");
            let block = block2::RcBlock::new(move |_: *const AnyObject| schedule_flush());
            let _: Retained<AnyObject> = msg_send![
                &*center,
                addObserverForName: &*name,
                object: &*view,
                queue: std::ptr::null::<AnyObject>(),
                usingBlock: &*block
            ];
        }
    }
    schedule_flush();
}

pub fn clear_on_resize(handle: i64) {
    CALLBACKS.with(|c| c.borrow_mut().remove(&handle));
    REPORTED.with(|r| r.borrow_mut().remove(&handle));
}

fn schedule_flush() {
    if FLUSH_SCHEDULED.with(|s| s.replace(true)) {
        return;
    }
    unsafe {
        dispatch_async_f(
            &_dispatch_main_q as *const _ as *const std::ffi::c_void,
            std::ptr::null_mut(),
            flush,
        );
    }
}

unsafe extern "C" fn flush(_: *mut std::ffi::c_void) {
    FLUSH_SCHEDULED.with(|s| s.set(false));
    let entries: Vec<(i64, f64)> =
        CALLBACKS.with(|c| c.borrow().iter().map(|(k, v)| (*k, *v)).collect());
    for (handle, callback) in entries {
        let Some(view) = super::get_widget(handle) else {
            continue;
        };
        let size = view.frame().size;
        let size = (size.width, size.height);
        let changed = REPORTED.with(|r| r.borrow_mut().insert(handle, size) != Some(size));
        if !changed {
            continue;
        }
        crate::catch_callback_panic(
            "resize callback",
            std::panic::AssertUnwindSafe(|| {
                let ptr = js_nanbox_get_pointer(callback) as *const u8;
                if !ptr.is_null() {
                    js_closure_call2(ptr, perry_ffi::JsThis::UNDEFINED, size.0, size.1);
                }
            }),
        );
    }
}
