import { HttpError } from "./http";
import { Signature, type UserDoc } from "./models";

/** True only if the user's signature record really exists. */
export async function hasSignature(user: Pick<UserDoc, "signature">) {
  return !!user.signature && !!(await Signature.exists({ _id: user.signature }));
}

/** The signer's e-signature as it is stamped onto a document right now. */
export async function eSignatureOf(user: UserDoc) {
  if (!(await hasSignature(user))) {
    throw new HttpError(400, "Add your e-signature first (My e-signature page) before signing documents.");
  }
  return { user: user._id, name: user.name, title: user.title || "", signature: user.signature, signedAt: new Date() };
}
