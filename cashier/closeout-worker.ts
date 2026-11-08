import {WorkerEntrypoint} from 'cloudflare:workers';
import {previewEventCloseout,closeOutEvent} from './lib/event-closeout.mjs';

// Private service-binding capability. No public fetch handler and no npm imports.
// Commish authenticates its admin and freezes the exact event before close().
export class EventCloseout extends WorkerEntrypoint<{DB:D1Database}> {
 async preview(input:unknown){return previewEventCloseout(this.env.DB,input);}
 async close(input:unknown){return closeOutEvent(this.env.DB,input);}
}
