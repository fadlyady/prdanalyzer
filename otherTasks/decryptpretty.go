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
	// secretKey := "cqu-QvqbFuY-0q_QJZsNZxlMHzVCg_sj"
	secretKey := "Qzrx4I8_HCtIC66c6vuFlpzT5OO3pgEf"
	encryptedData := "Zb0fjc4lWpUlz9ITrs/pEuSo//hcG1wC5xsnpRNtfvDziiiPCivlqAhjC9bL25htRxzYKz8SvIk8OOuCG+4boTEJYeX8I890yZVWyB+HOtCt8//6opZ1mn3TJPLg9kcF9ZopP5ZFR86gKmeN0k+VQokngiU9tD+qwzSaJbmzhX2JlSGsvwgbgEN4fCn2RUI8yfqNylivCJLUJPQc1oMo+GFHIowXdW64tRttMEUXe8/NzoBMOTW8wtMic0XB1IYIL7BMmMjBKZDIMhjj17DLw1xXwKgs5MP0WkpDjTReRM4rXjih1QLKLayRdsHRZ3komWsD+EkoklEMNnDe0GUFJNMDO8GVsnL2Y2EGNaCvVYdlyRATlxj6L6kqJ5AqjLta3jxZ+KTU8S43GCnXekUNUB2IzcEt6Z/Y4bikK9EXB56BSrzBWCq6P9JLPY0qX0hMkFloAnhcHJKevVvM/HI5oW6WO3GyDph3T5AXJ+WbOl5k25Aqm0uhetPjLInqnzUmgXrL/c2VnONTSD8Z4itX3N7kWbvvjSCMuWUUrKBpM2QQuA39sMfXD1Swmpqth76j+V9BjseffIf2jsfV3Z35mWHQ9u/92HBiOJqXnPwwS7Qq8T0900zLyBbBMozJdf9Ii5tAwMO9BHly+nC/NuhiUvwl"

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
