import "server-only";
import { firebaseAdmin } from "./firebaseAdmin";
import { deviceLinkService } from "./deviceLinkService";
import { deviceLinkHttp, type LinkAction } from "./deviceLinkHttp";

export function linkHandler(action: LinkAction) {
  return deviceLinkHttp(action, () => {
    const { auth, db } = firebaseAdmin();
    return {
      verify: async token => {
        const user = await auth.verifyIdToken(token, true);
        return { uid: user.uid, anonymous: user.firebase.sign_in_provider === "anonymous" };
      },
      service: deviceLinkService({
        now: Date.now,
        cleanSince: Number(process.env.DEVICE_LINK_CLEAN_SINCE),
        userCreatedAt: async uid => Date.parse((await auth.getUser(uid)).metadata.creationTime),
        mintToken: uid => auth.createCustomToken(uid),
        transaction: fn => db.runTransaction(tx => fn({
          get: async path => (await tx.get(db.doc(path))).data(),
          set: (path, value) => { tx.set(db.doc(path), value); },
        })),
      }),
    };
  });
}