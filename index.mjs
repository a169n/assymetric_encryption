import inquirer from "inquirer";
import chalk from "chalk";
import crypto from "crypto";
import fs from "fs/promises";

class Block {
  constructor(index, transactions, previousHash = "") {
    this.index = index;
    this.timestamp = new Date().toISOString();
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const data =
      this.index +
      this.timestamp +
      JSON.stringify(this.transactions) +
      this.previousHash;
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = [];
    this.difficulty = 2;
  }

  createGenesisBlock() {
    return new Block(0, [], "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions(miningRewardAddress) {
    const rewardTransaction = new Transaction(null, miningRewardAddress, 100);
    this.pendingTransactions.push(rewardTransaction);

    const block = new Block(
      this.getLatestBlock().index + 1,
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.mineBlock(this.difficulty);

    console.log(chalk.green("Block successfully mined!"));
    this.chain.push(block);

    this.pendingTransactions = [];
  }

  createTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const transaction of block.transactions) {
        if (transaction.fromAddress === address) {
          balance -= transaction.amount;
        }

        if (transaction.toAddress === address) {
          balance += transaction.amount;
        }
      }
    }

    return balance;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }

    return true;
  }
}

class Transaction {
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = new Date().toISOString();
  }
}

async function generateKeyPair() {
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

const blockchain = new Blockchain();

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
    await generateKeyPair();

  console.log(
    chalk.yellow(`Generating keys for recipient: ${recipientUsername}...`)
  );
  const { publicKey: recipientPublicKey, privateKey: recipientPrivateKey } =
    await generateKeyPair();

  await saveKeyToFile(senderUsername, senderPrivateKey, "privateKey");
  await saveKeyToFile(recipientUsername, recipientPublicKey, "publicKey");

  console.log(chalk.yellow("Sending and saving the message..."));

  const { encryptedMessage, signature, decryptedMessage } = await sendMessage(
    senderPrivateKey,
    recipientPublicKey,
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

  console.log(chalk.yellow("Mining a block..."));
  blockchain.createTransaction(
    new Transaction(senderUsername, recipientUsername, 1)
  );
  blockchain.minePendingTransactions("miner-reward-address");

  console.log(
    chalk.green(
      "Balance of sender:",
      blockchain.getBalanceOfAddress(senderUsername)
    )
  );
  console.log(
    chalk.green(
      "Balance of recipient:",
      blockchain.getBalanceOfAddress(recipientUsername)
    )
  );
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
