import '../scss/main.scss'

import barba from '@barba/core';

import Home from './pages/home';
import CursorControl from './pages/cursor_control';
import About from './pages/about';

barba.init({
    views: [About, CursorControl, Home],
    transitions: [
        // ONCE TRANSITIONS
        {
            name: '1: home once',
            from: {
                namespace: ['']
            },
            to: {
                namespace: ['home']
            },
            once(data) {
                console.log('1: home once')
            }
        },
        {
            name: '2: about once',
            from: {
                namespace: ['']
            },
            to: {
                namespace: ['about']
            },
            once(data) {
                console.log('2: about once')
            }
        },
        {
            name: '3: cursor_control once',
            from: {
                namespace: ['']
            },
            to: {
                namespace: ['cursor_control']
            },
            once(data) {
                console.log('3: cursor_control once')
            }
        },
        // HOME TRANSITIONS
        {
            name: '4: about to home',
            from: {
                namespace: ['about']
            },
            to: {
                namespace: ['home']
            },
            enter(data) {
                console.log('4: home enter')
            },
            leave(data) {
                console.log('4: about leave')
            }
        },
        {
            name: '5: cursor_control to home',
            from: {
                namespace: ['cursor_control']
            },
            to: {
                namespace: ['home']
            },
            enter(data) {
                console.log('5: home enter')
            },
            leave(data) {
                console.log('5: cursor_control leave')
            }
        },
        // ABOUT TRANSITIONS
        {
            name: '6: home to about',
            from: {
                namespace: ['home']
            },
            to: {
                namespace: ['about']
            },
            enter(data) {
                console.log('6: about enter')
            },
            leave(data) {
                console.log('6: home leave')
            }
        },
        {
            name: '7: cursor_control to about',
            from: {
                namespace: ['cursor_control']
            },
            to: {
                namespace: ['about']
            },
            enter(data) {
                console.log('7: about enter')
            },
            leave(data) {
                console.log('7: cursor_control leave')
            }
        },
        // CURSOR_CONTROL TRANSITIONS
        {
            name: '8: about to cursor_control',
            from: {
                namespace: ['about']
            },
            to: {
                namespace: ['cursor_control']
            },
            enter(data) {
                console.log('8: cursor_control enter')
            },
            leave(data) {
                console.log('8: about leave')
            }
        },
        {
            name: '9: home to cursor_control',
            from: {
                namespace: ['home']
            },
            to: {
                namespace: ['cursor_control']
            },
            enter(data) {
                console.log('9: cursor_control enter')
            },
            leave(data) {
                console.log('9: home leave')
            }
        }
    ]
});