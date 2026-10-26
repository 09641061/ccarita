import { Routes } from '@angular/router';

/** `/mensajes`: the inbox, with a conversation as its child. */
export const conversationsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./views/inbox/inbox').then((m) => m.Inbox),
    title: 'Mensajes · Takodu',
    children: [
      {
        path: ':conversationId',
        loadComponent: () => import('./views/chat/chat').then((m) => m.Chat),
        title: 'Conversación · Takodu',
      },
    ],
  },
];
