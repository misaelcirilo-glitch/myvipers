import 'server-only';
import webpush from 'web-push';
import { db } from './db';

let configured = false;

function configure() {
    if (configured) return true;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@myvipers.app';
    if (!pub || !priv) return false;
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
    return true;
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
}

export async function sendPushToRestaurant(
    restaurantId: string,
    payload: PushPayload
): Promise<{ sent: number; failed: number; skipped: boolean }> {
    if (!configure()) return { sent: 0, failed: 0, skipped: true };

    const subs = await db`
        SELECT id, endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE restaurant_id = ${restaurantId}
    ` as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;

    if (subs.length === 0) return { sent: 0, failed: 0, skipped: false };

    const body = JSON.stringify(payload);
    let sent = 0;
    let failed = 0;
    const toDelete: string[] = [];

    await Promise.all(subs.map(async (s) => {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                body
            );
            sent++;
        } catch (err: any) {
            failed++;
            if (err?.statusCode === 404 || err?.statusCode === 410) {
                toDelete.push(s.id);
            }
        }
    }));

    if (toDelete.length > 0) {
        await db`DELETE FROM push_subscriptions WHERE id = ANY(${toDelete}::uuid[])`;
    }

    return { sent, failed, skipped: false };
}
