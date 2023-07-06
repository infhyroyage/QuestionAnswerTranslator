import { ManagedIdentityCredential } from "@azure/identity";
import {
  CryptographyClient,
  DecryptResult,
  EncryptResult,
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
 * 指定したstring型の平文(複数個)を、それぞれstring型→Uint8Array型→number[]型として暗号化する
 * @param {string[]} rawStrings 平文(複数個)
 * @param {CryptographyClient} cryptographyClient Key Vaultでの暗号化/復号クライアント
 * @returns {Promise<number[][]>} 暗号化した0〜255の値を持つ配列(複数個)のPromise
 */
export const encryptStrings2NumberArrays = async (
  rawStrings: string[],
  cryptographyClient: CryptographyClient
): Promise<number[][]> => {
  const encryptResults: EncryptResult[] = await Promise.all(
    rawStrings.map(
      (rawString: string, i: number): Promise<EncryptResult> =>
        cryptographyClient
          .encrypt({
            algorithm: "RSA1_5",
            plaintext: Buffer.from(rawString),
          })
          .catch((e) => {
            console.error(
              `${i}th Encrypt Error(${rawString.length} chars): ${rawString}`
            );
            throw e;
          })
    )
  );
  return encryptResults.map((encryptedResult: EncryptResult) =>
    Array.from(encryptedResult.result)
  );
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
      (encryptedString: number[]): Promise<DecryptResult> =>
        cryptographyClient.decrypt({
          algorithm: "RSA1_5",
          ciphertext: Uint8Array.from(encryptedString),
        })
    )
  );
  return decryptResults.map((decryptResult: DecryptResult) =>
    decryptResult.result.toString()
  );
};
