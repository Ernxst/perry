//! `NSPopover`, which floats a widget beside another until the app closes it.

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::msg_send;
use objc2_core_foundation::{CGRect, CGSize};
use std::cell::RefCell;

thread_local! {
    /// Each popover with the handle of the widget it holds.
    static POPOVERS: RefCell<Vec<(Retained<AnyObject>, i64)>> = const { RefCell::new(Vec::new()) };
}

/// Create a popover holding `body_handle`. Returns the 1-based popover handle, or 0 when the
/// body isn't a widget.
pub fn create(body_handle: i64) -> i64 {
    let (Some(popover_class), Some(controller_class)) = (AnyClass::get(c"NSPopover"), AnyClass::get(c"NSViewController")) else {
        return 0;
    };
    let Some(body) = super::get_widget(body_handle) else { return 0 };
    unsafe {
        let popover: Retained<AnyObject> = msg_send![popover_class, new];
        let controller: Retained<AnyObject> = msg_send![controller_class, new];
        let _: () = msg_send![&*controller, setView: &*body];
        let _: () = msg_send![&*popover, setContentViewController: &*controller];
        // NSPopoverBehaviorApplicationDefined: only `close` closes it, so the app decides what a
        // press outside or Escape does.
        let _: () = msg_send![&*popover, setBehavior: 0isize];
        POPOVERS.with(|p| {
            let mut popovers = p.borrow_mut();
            popovers.push((popover, body_handle));
            popovers.len() as i64
        })
    }
}

fn popover(handle: i64) -> Option<(Retained<AnyObject>, i64)> {
    POPOVERS.with(|p| p.borrow().get((handle - 1) as usize).cloned())
}

/// Show the popover beside `anchor_handle`, sized to fit its body. `side` is 0 for above the
/// anchor, 1 for its right, 2 for below and 3 for its left; AppKit picks another side when
/// there's no room.
pub fn show(handle: i64, anchor_handle: i64, side: f64) {
    let Some((popover, body_handle)) = popover(handle) else { return };
    let (Some(anchor), Some(body)) = (super::get_widget(anchor_handle), super::get_widget(body_handle)) else { return };
    let size: CGSize = body.fittingSize();
    // NSRectEdge counts in the anchor's own coordinates, where the top is MaxY unless it's flipped.
    let top: usize = if anchor.isFlipped() { 1 } else { 3 };
    let edge: usize = match side as i64 {
        0 => top,
        1 => 2,
        3 => 0,
        _ => 4 - top,
    };
    let bounds: CGRect = anchor.bounds();
    unsafe {
        let _: () = msg_send![&*popover, setContentSize: size];
        let _: () = msg_send![&*popover, showRelativeToRect: bounds, ofView: &*anchor, preferredEdge: edge];
    }
}

/// Close the popover.
pub fn close(handle: i64) {
    if let Some((popover, _)) = popover(handle) {
        unsafe {
            let _: () = msg_send![&*popover, close];
        }
    }
}
