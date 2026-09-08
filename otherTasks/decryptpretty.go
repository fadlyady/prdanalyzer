// You can edit this code!
// Click here and start typing.
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

// EncryptAES256GCM encrypts text using AES-256-GCM. The secret is hashed with
// SHA-256 to derive a 32-byte key regardless of its input length. A fresh random
// nonce is generated per call and prepended to the returned ciphertext, so the
// same plaintext encrypts to a different value every time.
func EncryptAES256GCM(text []byte, secret string) (string, error) {
	key := sha256.Sum256([]byte(secret))

	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherText := gcm.Seal(nonce, nonce, text, nil)
	return base64.StdEncoding.EncodeToString(cipherText), nil
}

// DecryptAES256GCM decrypts a value produced by EncryptAES256GCM.
func DecryptAES256GCM(text, secret string) ([]byte, error) {
	key := sha256.Sum256([]byte(secret))

	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	data, err := base64.StdEncoding.DecodeString(text)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, cipherText := data[:nonceSize], data[nonceSize:]
	plainText, err := gcm.Open(nil, nonce, cipherText, nil)
	if err != nil {
		return nil, err
	}

	return plainText, nil
}

func main() {
	secretKey := "cqu-QvqbFuY-0q_QJZsNZxlMHzVCg_sj"
	encryptedData := "FDGQxCZJLsn3r4shAlOCF6L0i2E8xFIlJq39BfxbPXAL9tuvn9sA1EfjEMTpFFRQSWL98TTyeQfZhWAy0rVfTDpzADnNH4Nqj99wrPsralHII0yqk81GNcZ1jCV+LKHvrd3i0vMtnO26gtkxW6nYCCqOxrd84/i0Qtl1+14MvtmpOQDRqy7CJczfMzBH3eGIv6REQmpaXSpa9lbh2RxDseutGH5b0vSZZ17OnqszSC+pmr4elHO4RAQ9mQhtxl7H3n6JdClvhzrYOSm0inzf7vmM8T77enwjaSAKfJRstJ0TxXgISl1N/S0wJBnOmEvfKs5hhYvVmGmvy59FtEVz6msEBdBUS2QTK7f5PtqCertk5uGwf8Be8i9TLK7XXgxkfuJN5B/Dv9nIjSNRUtJZdXCTlK2OdkDOKxA2GpsylJNDFiePo3GRKRqFNqUBSstw8tFNKpfBh6pjsBV0A7Sq6GLPjb5lPTPM+oQj+ZrSaDpSuAE/rRjaP09IjobHYwbosGtn+bxx+SsMHXRj3LSKrjnDIzr5ceHfisP7Ai6dJB697gFmHYpEzf+RnUf33t1FCrXmLpQ+1MYVuPKDDMCuHWgtA6BIhXJLFmH+XvXX4IJ+Hi/b509MKTpQmSChMNF/HEJ+rQJ38yYob9snJ+C5LJTY9xLQYlNqgDS4iCHd2QAPPRUphDS3t6tNrbQhU4ysebAI2WuP+EY5i0dpzZUNe+xNdXrbnid6b7oYq38WczYQystYeg=="

	// Decrypt
	decryptedData, err := DecryptAES256GCM(encryptedData, secretKey)
	if err != nil {
		fmt.Println("err", err)
		return
	}

	// Pretty print JSON
	var prettyJSON bytes.Buffer
	err = json.Indent(&prettyJSON, decryptedData, "", "  ")
	if err != nil {
		fmt.Println("invalid JSON:", err)
		fmt.Printf("Raw Decrypted Data: %s\n", string(decryptedData))
		return
	}

	fmt.Printf("Decrypted Data:\n%s\n", prettyJSON.String())
}
