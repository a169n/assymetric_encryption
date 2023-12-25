# Blockchain Messaging App

This is a simple blockchain messaging application that allows users to send encrypted messages using RSA public-key cryptography. Users can also sign messages if desired.

## Prerequisites

- Node.js installed on your machine

## How to Run

1. **Clone this repository to your local machine:**

This step fetches the code from the GitHub repository to your local machine.

2. **Navigate to the project directory:**

Move into the project directory to run the application.

3. **Install dependencies:**

Install the required Node.js dependencies for the project.

`npm i inquirer chalk crypto fs`

4. **Run the application:**

Follow the interactive prompts to send messages and save transactions.

This command executes the main script (`index.mjs`) and starts the interactive messaging application.

`node index.mjs`

## Project Structure

The project is structured as follows:

- `index.mjs`: Main script to run the application.
- `messages.json`: File to store recorded transactions.
- `./<username>`: Folders to store public and private keys for each user.
