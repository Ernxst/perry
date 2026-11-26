use crate::ffi::{js_array_push_f64, js_string_from_bytes};
use objc2::msg_send;
use objc2_app_kit::NSOpenPanel;
use objc2_foundation::{MainThreadMarker, NSString};

extern "C" {
    fn js_closure_call1(closure: *const u8, this: perry_ffi::JsThis, arg: f64) -> f64;
    fn js_nanbox_get_pointer(value: f64) -> i64;
    fn js_nanbox_string(ptr: i64) -> f64;
    fn js_array_alloc(capacity: u32) -> *mut std::ffi::c_void;
    fn js_nanbox_pointer(ptr: i64) -> f64;
}

/// Open a file dialog that allows several files. Calls `callback` with an array of the chosen
/// paths, empty when the user cancels.
pub fn open_files_dialog(callback: f64) {
    let _mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");
    unsafe {
        let panel: objc2::rc::Retained<NSOpenPanel> = msg_send![
            objc2::runtime::AnyClass::get(c"NSOpenPanel").unwrap(),
            openPanel
        ];
        panel.setCanChooseFiles(true);
        panel.setCanChooseDirectories(false);
        panel.setAllowsMultipleSelection(true);

        let response: isize = msg_send![&*panel, runModal];
        let mut paths = Vec::new();
        if response == 1 {
            let urls = panel.URLs();
            for i in 0..urls.len() {
                let path: objc2::rc::Retained<NSString> = msg_send![&urls.objectAtIndex(i), path];
                paths.push(path.to_string());
            }
        }

        let mut array = js_array_alloc(paths.len() as u32);
        for path in &paths {
            let header = js_string_from_bytes(path.as_ptr(), path.len() as u32);
            array = js_array_push_f64(array, js_nanbox_string(header as i64));
        }
        let closure_ptr = js_nanbox_get_pointer(callback) as *const u8;
        js_closure_call1(closure_ptr, perry_ffi::JsThis::UNDEFINED, js_nanbox_pointer(array as i64));
    }
}

/// Open a file dialog. Calls callback with the selected file path (NaN-boxed string).
/// If user cancels, callback is called with TAG_UNDEFINED.
pub fn open_dialog(callback: f64) {
    let _mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");
    unsafe {
        let panel: objc2::rc::Retained<NSOpenPanel> = msg_send![
            objc2::runtime::AnyClass::get(c"NSOpenPanel").unwrap(),
            openPanel
        ];
        panel.setCanChooseFiles(true);
        panel.setCanChooseDirectories(false);
        panel.setAllowsMultipleSelection(false);

        // Run modal (blocks until user responds)
        let response: isize = msg_send![&*panel, runModal];
        let closure_ptr = js_nanbox_get_pointer(callback) as *const u8;

        if response == 1 {
            // NSModalResponseOK = 1
            let urls = panel.URLs();
            if !urls.is_empty() {
                let url = &urls.objectAtIndex(0);
                let path_str: objc2::rc::Retained<NSString> = msg_send![url, path];
                let rust_str = path_str.to_string();
                let bytes = rust_str.as_bytes();
                let str_ptr = js_string_from_bytes(bytes.as_ptr(), bytes.len() as u32);
                let nanboxed = js_nanbox_string(str_ptr as i64);
                js_closure_call1(closure_ptr, perry_ffi::JsThis::UNDEFINED, nanboxed);
            } else {
                js_closure_call1(
                    closure_ptr,
                    perry_ffi::JsThis::UNDEFINED,
                    f64::from_bits(0x7FFC_0000_0000_0001),
                );
            }
        } else {
            // User cancelled
            js_closure_call1(
                closure_ptr,
                perry_ffi::JsThis::UNDEFINED,
                f64::from_bits(0x7FFC_0000_0000_0001),
            );
        }
    }
}

/// Open a folder dialog. Calls callback with the selected directory path (NaN-boxed string).
/// If user cancels, callback is called with TAG_UNDEFINED.
pub fn open_folder_dialog(callback: f64) {
    let _mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");
    unsafe {
        let panel: objc2::rc::Retained<NSOpenPanel> = msg_send![
            objc2::runtime::AnyClass::get(c"NSOpenPanel").unwrap(),
            openPanel
        ];
        panel.setCanChooseFiles(false);
        panel.setCanChooseDirectories(true);
        panel.setAllowsMultipleSelection(false);

        let response: isize = msg_send![&*panel, runModal];
        let closure_ptr = js_nanbox_get_pointer(callback) as *const u8;

        if response == 1 {
            let urls = panel.URLs();
            if !urls.is_empty() {
                let url = &urls.objectAtIndex(0);
                let path_str: objc2::rc::Retained<NSString> = msg_send![url, path];
                let rust_str = path_str.to_string();
                let bytes = rust_str.as_bytes();
                let str_ptr = js_string_from_bytes(bytes.as_ptr(), bytes.len() as u32);
                let nanboxed = js_nanbox_string(str_ptr as i64);
                js_closure_call1(closure_ptr, perry_ffi::JsThis::UNDEFINED, nanboxed);
            } else {
                js_closure_call1(
                    closure_ptr,
                    perry_ffi::JsThis::UNDEFINED,
                    f64::from_bits(0x7FFC_0000_0000_0001),
                );
            }
        } else {
            js_closure_call1(
                closure_ptr,
                perry_ffi::JsThis::UNDEFINED,
                f64::from_bits(0x7FFC_0000_0000_0001),
            );
        }
    }
}

/// Save file dialog. Calls callback with selected path (NaN-boxed string) or TAG_UNDEFINED.
pub fn save_dialog(callback: f64, default_name_ptr: *const u8, _allowed_types_ptr: *const u8) {
    use perry_ffi::copy_string_from_raw as str_from_header;

    let _mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");
    unsafe {
        let panel_cls = objc2::runtime::AnyClass::get(c"NSSavePanel").unwrap();
        let panel: objc2::rc::Retained<objc2::runtime::AnyObject> = msg_send![panel_cls, savePanel];

        // Set default filename if provided
        if !default_name_ptr.is_null() {
            let name = str_from_header(default_name_ptr);
            if !name.is_empty() {
                let ns_name = NSString::from_str(&name);
                let _: () = msg_send![&*panel, setNameFieldStringValue: &*ns_name];
            }
        }

        // Run modal
        let response: isize = msg_send![&*panel, runModal];
        let closure_ptr = js_nanbox_get_pointer(callback) as *const u8;

        if response == 1 {
            // NSModalResponseOK = 1
            let url: *mut objc2::runtime::AnyObject = msg_send![&*panel, URL];
            if !url.is_null() {
                let path_str: objc2::rc::Retained<NSString> = msg_send![url, path];
                let rust_str = path_str.to_string();
                let bytes = rust_str.as_bytes();
                let str_ptr = js_string_from_bytes(bytes.as_ptr(), bytes.len() as u32);
                let nanboxed = js_nanbox_string(str_ptr as i64);
                js_closure_call1(closure_ptr, perry_ffi::JsThis::UNDEFINED, nanboxed);
            } else {
                js_closure_call1(
                    closure_ptr,
                    perry_ffi::JsThis::UNDEFINED,
                    f64::from_bits(0x7FFC_0000_0000_0001),
                );
            }
        } else {
            js_closure_call1(
                closure_ptr,
                perry_ffi::JsThis::UNDEFINED,
                f64::from_bits(0x7FFC_0000_0000_0001),
            );
        }
    }
}
