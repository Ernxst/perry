use objc2_core_foundation::{CGPoint, CGRect};

/// One side of a widget's frame after layout, in points within its window's content, with `y`
/// counted down from the top as a browser's viewport does: `part` 0 is x, 1 y, 2 width and
/// 3 height. A widget outside any window reports its size at 0, 0; an unknown handle reports 0.
pub fn frame_part(handle: i64, part: f64) -> f64 {
    let Some(view) = super::get_widget(handle) else {
        return 0.0;
    };
    let frame = match view.window() {
        Some(window) => {
            if let Some(content) = window.contentView() {
                content.layoutSubtreeIfNeeded();
                let rect = view.convertRect_toView(view.bounds(), Some(&content));
                let y = if content.isFlipped() {
                    rect.origin.y
                } else {
                    content.bounds().size.height - rect.origin.y - rect.size.height
                };
                CGRect::new(CGPoint::new(rect.origin.x, y), rect.size)
            } else {
                view.frame()
            }
        }
        None => CGRect::new(Default::default(), view.frame().size),
    };
    match part as i64 {
        0 => frame.origin.x,
        1 => frame.origin.y,
        2 => frame.size.width,
        3 => frame.size.height,
        _ => 0.0,
    }
}
