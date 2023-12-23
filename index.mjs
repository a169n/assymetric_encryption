import inquirer from "inquirer";
import chalk from "chalk";
import crypto from "crypto";
import fs from "fs/promises";

class Block {
  constructor(index, previousHash, timestamp, data, hash) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash;
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = [];
  }

  createGenesisBlock() {
    return new Block(0, null, new Date().toISOString(), "Genesis Block", "");
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(newBlock) {
    newBlock.index = this.getLastBlock().index + 1;
    newBlock.previousHash = this.getLastBlock().hash;
    newBlock.hash = this.calculateHash(
      newBlock.index,
      newBlock.previousHash,
      newBlock.timestamp,
      newBlock.data
    );
    this.chain.push(newBlock);
  }

  addTransaction(sender, recipient, amount, timestamp) {
    const transaction = {
      sender,
      recipient,
      amount,
      timestamp,
    };
    this.pendingTransactions.push(transaction);
  }

  processPendingTransactions(miningRewardAddress, miningRewardAmount) {
    const blockData = {
      transactions: [...this.pendingTransactions],
    };

    const newBlock = new Block(
      null,
      null,
      new Date().toISOString(),
      blockData,
      ""
    );

    this.addBlock(newBlock);

    // Reward the miner for processing the transactions
    this.addTransaction(
      null,
      miningRewardAddress,
      miningRewardAmount,
      new Date().toISOString()
    );

    this.pendingTransactions = [];
  }

  calculateHash(index, previousHash, timestamp, data) {
    return crypto
      .createHash("sha256")
      .update(index + previousHash + timestamp + JSON.stringify(data))
      .digest("hex");
  }
}

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
  blockchain,
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

  const newBlockData = {
    senderPrivateKey,
    recipientPublicKey,
    encryptedMessage: encryptedBuffer.toString("base64"),
    signature: signature ? signature.toString("base64") : null,
    decryptedMessage,
  };

  const newBlock = new Block(
    0,
    null,
    new Date().toISOString(),
    newBlockData,
    ""
  );
  blockchain.addBlock(newBlock);

  return {
    encryptedMessage: encryptedBuffer.toString("base64"),
    signature,
    decryptedMessage,
    blockIndex: newBlock.index,
    blockHash: newBlock.hash,
  };
}

async function saveTransaction(
  sender,
  recipient,
  encryptedMessage,
  signature,
  decryptedMessage,
  timestamp,
  blockIndex,
  blockHash,
  previousBlockHash
) {
  const transaction = {
    sender,
    recipient,
    encryptedMessage,
    signature: signature ? signature.toString("base64") : null,
    decryptedMessage,
    timestamp,
    blockIndex,
    blockHash,
    previousBlockHash,
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
  const blockchain = new Blockchain();

  let continueProcess = true;

  while (continueProcess) {
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
      {
        type: "input",
        name: "miningRewardAddress",
        message: "Enter mining reward address:",
      },
      {
        type: "input",
        name: "miningRewardAmount",
        message: "Enter mining reward amount:",
        validate: (input) => {
          const amount = parseFloat(input);
          return !isNaN(amount) && amount > 0;
        },
      },
      {
        type: "confirm",
        name: "addAnotherBlock",
        message: "Do you want to add another block?",
        default: false,
      },
      {
        type: "confirm",
        name: "addTransactionToBlockchain",
        message: "Do you want to add this transaction to the blockchain?",
        default: true,
      },
    ]);

    const senderUsername = answers.sender.toLowerCase();
    const recipientUsername = answers.recipient.toLowerCase();
    const signMessage = answers.signMessage;
    const message = answers.message;
    const miningRewardAddress = answers.miningRewardAddress;
    const miningRewardAmount = parseFloat(answers.miningRewardAmount);
    const addAnotherBlock = answers.addAnotherBlock;
    const addTransactionToBlockchain = answers.addTransactionToBlockchain;

    console.log(
      chalk.yellow(`Generating keys for sender: ${senderUsername}...`)
    );
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

    const lastBlock = blockchain.getLastBlock();
    const {
      encryptedMessage,
      signature,
      decryptedMessage,
      blockIndex,
      blockHash,
    } = await sendMessage(
      senderPrivateKey,
      recipientPublicKey,
      recipientPrivateKey,
      message,
      blockchain,
      signMessage ? (data) => crypto.sign(null, data, senderPrivateKey) : null
    );

    // Mine a block with the provided mining reward address and amount
    blockchain.processPendingTransactions(
      miningRewardAddress,
      miningRewardAmount
    );

    if (addTransactionToBlockchain) {
      await saveTransaction(
        senderUsername,
        recipientUsername,
        encryptedMessage,
        signature,
        decryptedMessage,
        new Date().toISOString(),
        blockIndex,
        blockHash,
        lastBlock ? lastBlock.hash : null
      );
    }

    if (!addAnotherBlock) {
      continueProcess = false;
    }
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
