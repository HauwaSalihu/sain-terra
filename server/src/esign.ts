import { HttpError } from "./http";
import type { UserDoc } from "./models";

/** The signer's e-signature as it is stamped onto a document right now. */
export function eSignatureOf(user: UserDoc) {
  if (!user.signature) {
    throw new HttpError(400, "Add your e-signature first (My e-signature page) before signing documents.");
  }
  return { user: user._id, name: user.name, title: user.title || "", signature: user.signature, signedAt: new Date() };
}
