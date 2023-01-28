import { ManagedIdentityCredential } from "@azure/identity";
import {
  CryptographyClient,
  DecryptResult,
  KeyClient,
  KeyVaultKey,
} from "@azure/keyvault-keys";

const VAULT_URL: string = "https://qatranslator-je-vault.vault.azure.net";

/**
 * Key Vaultで管理しているキーにおける、Key Vaultでの暗号化/復号クライアントを生成する
 * @param {string} keyName キー名
 * @returns {CryptographyClient} Key Vaultでの暗号化/復号クライアントのPromise
 */
export const createCryptographyClient = async (
  keyName: string
): Promise<CryptographyClient> => {
  const credential: ManagedIdentityCredential = new ManagedIdentityCredential();
  const keyClient: KeyClient = new KeyClient(VAULT_URL, credential);
  const importKey: KeyVaultKey = await keyClient.getKey(keyName);
  if (!importKey || !importKey.id) {
    throw new Error(`Key vault key "${keyName}" is not found.`);
  }
  return new CryptographyClient(importKey.id, credential);
};

/**
 * 指定した0~255の値を持つnumber[]型の暗号文(複数個)を、それぞれnumber[]型→Uint8Array型→string型として復号する
 * @param {number[][]} encryptedStrings 暗号化した0〜255の値を持つ配列(複数個)
 * @param {CryptographyClient} cryptographyClient Key Vaultでの暗号化/復号クライアント
 * @returns {Promise<string[]>} 平文(複数個)のPromise
 */
export const decryptNumberArrays2Strings = async (
  encryptedStrings: number[][],
  cryptographyClient: CryptographyClient
): Promise<string[]> => {
  const decryptResults: DecryptResult[] = await Promise.all(
    encryptedStrings.map(
      (encryptedString: number[], i: number): Promise<DecryptResult> =>
        cryptographyClient
          .decrypt({
            algorithm: "RSA1_5",
            ciphertext: Uint8Array.from(encryptedString),
          })
          .catch((e) => {
            console.error(`${i}th Decrypt Error`);
            throw e;
          })
    )
  );
  return decryptResults.map((decryptResult: DecryptResult) =>
    decryptResult.result.toString()
  );
};
