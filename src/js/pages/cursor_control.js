import Cursor from "../cursor";

class CursorControl {
    namespace = 'cursor_control';
    beforeEnter = data => {
        console.log('CursorControl beforeEnter')
        // Once
        if (data.current.namespace === '') {
            let c = new Cursor({
                inner: document.getElementById('cursor__inner'),
                outer: document.getElementById('cursor__outer')
            });
        }
    }
    afterEnter = data => {
        console.log('CursorControl afterEnter')
    }
    beforeLeave = data => {
        console.log('CursorControl beforeLeave')
    }
    afterLeave = data => {
        console.log('CursorControl afterLeave')
    }
}
export default new CursorControl();