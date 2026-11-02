import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK. Для проверки ID-токена достаточно projectId —
 * сервисный аккаунт (clientEmail/privateKey) нужен только для управления
 * пользователями (создание/удаление) и не обязателен для verifyIdToken.
 */
@Injectable()
export class FirebaseService {
  private readonly app: admin.app.App;

  constructor() {
    if (admin.apps.length > 0) {
      this.app = admin.app();
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID env var is required for Firebase Admin');
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const credential =
      clientEmail && rawKey
        ? admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: rawKey.replace(/\\n/g, '\n'),
          })
        : undefined;

    // credential: undefined firebase-admin отвергает — передаём ключ только если он есть
    this.app = admin.initializeApp(credential ? { projectId, credential } : { projectId });
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.app.auth().verifyIdToken(idToken);
  }
}
