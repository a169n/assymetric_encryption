import inquirer from "inquirer";
import chalk from "chalk";
import crypto from "crypto";
import fs from "fs/promises";

function generateKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

async function saveKeyToFile(username, key, type) {
  const folderPath = `./${username}`;
  const filePath = `${folderPath}/${type}.pem`;

  try {
    await fs.mkdir(folderPath);
  } catch (error) {
    // Folder already exists, ignore the error
  }

  await fs.writeFile(filePath, key, "utf-8");
  console.log(chalk.green(`Key saved to: ${filePath}`));
}

async function sendMessage(
  senderPrivateKey,
  recipientPublicKey,
  recipientPrivateKey,
  message,
  signMessageFunction
) {
  const maxMessageLength = 190;

  if (Buffer.from(message, "utf-8").length > maxMessageLength) {
    throw new Error("Message is too long for RSA encryption");
  }

  const encryptedBuffer = crypto.publicEncrypt(
    {
      key: recipientPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(message, "utf-8")
  );

  const signature = signMessageFunction
    ? signMessageFunction(encryptedBuffer)
    : null;

  const decryptedBuffer = crypto.privateDecrypt(
    {
      key: recipientPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedBuffer
  );

  const decryptedMessage = decryptedBuffer.toString("utf-8");

  return {
    encryptedMessage: encryptedBuffer.toString("base64"),
    signature,
    decryptedMessage,
  };
}

async function saveTransaction(
  sender,
  recipient,
  encryptedMessage,
  signature,
  decryptedMessage,
  timestamp
) {
  const transaction = {
    sender,
    recipient,
    encryptedMessage,
    signature: signature ? signature.toString("base64") : null,
    decryptedMessage,
    timestamp,
  };
  const transactionsFile = "messages.json";

  try {
    const existingTransactions = await fs.readFile(transactionsFile, "utf-8");
    const allTransactions = JSON.parse(existingTransactions);
    allTransactions.push(transaction);
    await fs.writeFile(
      transactionsFile,
      JSON.stringify(allTransactions, null, 2),
      "utf-8"
    );
    console.log(chalk.green("Transaction saved successfully!"));
  } catch (error) {
    await fs.writeFile(
      transactionsFile,
      JSON.stringify([transaction], null, 2),
      "utf-8"
    );
    console.log(
      chalk.green("Transaction file created and saved successfully!")
    );
  }
}

async function main() {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "sender",
      message: "Enter sender name:",
    },
    {
      type: "input",
      name: "recipient",
      message: "Enter recipient name:",
    },
    {
      type: "confirm",
      name: "signMessage",
      message: "Do you want to sign the message?",
      default: true,
    },
    {
      type: "input",
      name: "message",
      message: "Enter the message to send:",
    },
  ]);

  const senderUsername = answers.sender.toLowerCase();
  const recipientUsername = answers.recipient.toLowerCase();
  const signMessage = answers.signMessage;
  const message = answers.message;

  console.log(chalk.yellow(`Generating keys for sender: ${senderUsername}...`));
  const { publicKey: senderPublicKey, privateKey: senderPrivateKey } =
    generateKeyPair();

  console.log(
    chalk.yellow(`Generating keys for recipient: ${recipientUsername}...`)
  );
  const { publicKey: recipientPublicKey, privateKey: recipientPrivateKey } =
    generateKeyPair();

  await saveKeyToFile(senderUsername, senderPrivateKey, "privateKey");
  await saveKeyToFile(recipientUsername, recipientPublicKey, "publicKey");

  console.log(chalk.yellow("Sending and saving the message..."));

  const { encryptedMessage, signature, decryptedMessage } = await sendMessage(
    senderPrivateKey,
    recipientPublicKey,
    recipientPrivateKey,
    message,
    signMessage ? (data) => crypto.sign(null, data, senderPrivateKey) : null
  );

  console.log(chalk.green(`Encrypted Message: ${encryptedMessage}`));
  console.log(chalk.green(`Signature: ${signature}`));
  console.log(chalk.green(`Decrypted Message: ${decryptedMessage}`));

  await saveTransaction(
    senderUsername,
    recipientUsername,
    encryptedMessage,
    signature,
    decryptedMessage,
    new Date().toISOString()
  );
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
