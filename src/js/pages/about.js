import Cursor from '../cursor';

class About {
    namespace = 'about';
    beforeEnter = data => {
        console.log('About beforeEnter')
        // Once
        if (data.current.namespace === '') {
            let c = new Cursor({
                inner: document.getElementById('cursor__inner'),
                outer: document.getElementById('cursor__outer')
            });
        }
    }
    afterEnter = data => {
        console.log('About afterEnter')
    }
    beforeLeave = data => {
        console.log('About beforeLeave')
    }
    afterLeave = data => {
        console.log('About afterLeave')
    }
}
export default new About();