/// <reference lib="webworker" />
import { io } from 'socket.io-client';
import { environment } from '../../../environments/environment';

// Resolve the backend origin from the same source the rest of the app
// already uses (graphql HTTP + graphql WS). Hardcoding `localhost` here
// broke realtime whenever the page was opened from a LAN device — the
// worker runs on that device, where `localhost` is the device itself,
// not the backend machine. Strip the trailing slash so socket.io-client
// receives a clean origin, e.g. http://192.168.1.22:3000.
const socketUrl = (environment.apiUrl || '').replace(/\/$/, '');
const socket = io(socketUrl);

socket.on('connect', () => {});

socket.on('sendDitoDiagnostique', (message: string) => {
    const data = {
        event: 'sendDitoDiagnostique',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('updateTicket', (message: string) => {
    const data = {
        event: 'updateTicket',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('reminder', (message: string) => {
    const data = {
        event: 'reminder',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('confirmAllComposant', (message: string) => {
    const data = {
        event: 'confirmAllComposant',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('sendNotifcationToAdmins', (message: string) => {
    const data = {
        event: 'sendNotifcationToAdmins',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

//continue here confirmation.

socket.on('component:sent_to_coordinator', (message: string) => {
    const data = {
        event: 'component:sent_to_coordinator',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

socket.on('component:confirmed_by_coordinator', (message: string) => {
    const data = {
        event: 'component:confirmed_by_coordinator',
        message,
    };
    postMessage(data); // Send the message to the main thread
});
socket.on('blAddedNotification', (message: string) => {
    const data = {
        event: 'blAddedNotification',
        message,
    };
    postMessage(data); // Send the message to the main thread
});

// -- Generic operational alerts (stagnation, future monitors) --
const alertEvents = ['alert.created', 'alert.resolved'];
for (const eventName of alertEvents) {
    socket.on(eventName, (message: any) => {
        postMessage({ event: eventName, message });
    });
}

addEventListener('message', ({ data }) => {
    if (data === 'start') {
    }
});
