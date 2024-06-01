
## About Me

My name is Jose Dennis, and I am a developer exploring the world of blockchain and smart contracts. ChiaRPSGame is my first project involving Chialisp and smart contracts, and it represents my initial steps into this exciting field.

Feel free to connect with me on Twitter: [@MrDennisV](https://x.com/MrDennisV)

If you would like to support my journey, consider making a donation to my XCH address:
```
xch1a63283n8rh7yksz03774s5jaq2rw5f4je5w3f7ux7esw9y6allusdrlhg5
```

Alternatively, you can purchase an NFT from my collection AMLITOVERSE:
[AMLITOVERSE on MintGarden](https://mintgarden.io/collections/amlitoverse-col1aspdzsk7hulkem4xqylpr5c3yufnuts95svlqxqnm9qfzwfpy8wq5drdca)

Thank you for your support!


# ChiaRPSGame

ChiaRPSGame is a project designed to practice what has been studied about Chialisp and smart contracts. This project allows playing the classic Rock, Paper, Scissors game using smart contracts on the Chia blockchain.

You can check out the demo at: [chiarps.mrdennis.dev](https://chiarps.mrdennis.dev)


## Description

ChiaRPSGame leverages the unique state management features of the Chia blockchain, utilizing a coin set model similar to Bitcoin's UTXO model. Instead of an account balance, players have a collection of unspent coins that can be spent, making everything in the Chia blockchain represented as coins. This approach introduces unique methods for creating decentralized applications.

### Key Components

- **GameWallet.clsp**: This smart contract acts as a virtual wallet for players to initiate or join games. It handles actions like cashing out, creating a game, and sending coins to the game.
- **Game.clsp**: This smart contract controls the game's logic. It manages the different stages of the game, such as player joining, revealing selections, closing the game, and claiming wins.
- **PublicOracle.clsp**: This smart contract acts as a public ledger that tracks all the games that have been played. It records the state of each game, including when games are opened, joined, and closed. This allows for transparency and ensures that all players can verify the integrity of the game history.
- **PlayerOracle.clsp**: This smart contract functions similarly to the PublicOracle but focuses on individual player activities. It tracks the actions of each player, such as game participation and outcomes. This personalized history allows players to review their performance and keep a record of their game activities.
- **RPSDriver**: This Python class serves as the main interface for interacting with the smart contracts and managing the game logic.


### How It Works

1. **Game Initialization**: Players load their virtual wallet with coins. The `GameWallet.clsp` contract handles the creation of a game, which involves placing a bet and providing a secret selection (Rock, Paper, or Scissors).
2. **Player Actions**: 
    - **Join Player 1**: The first player initiates a game by locking their bet and selection into a commitment.
    - **Join Player 2**: A second player joins the game by placing a matching bet and making their selection.
3. **Game Progression**: The game transitions through various states, each represented by coins that reflect the current game state.
4. **Revelation and Resolution**: The first player reveals their selection using their private key(passphrase). The game contract (`Game.clsp`) then determines the winner or if the game is a tie, based on both players' selections.
5. **Closure and Claims**: If the first player does not reveal their selection within a specified time(24 hrs), the second player can claim the bet. The game can also be closed if no opponent joins within a set time frame(24 hrs).


## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/jjldv/ChiaRPSGame.git
    cd ChiaRPSGame
    ```

2. Create and activate a virtual environment:
    ```sh
    python -m venv venv
    source venv/bin/activate   # On Windows use `venv\Scripts\activate`
    ```

3. Install the dependencies:
    ```sh
    pip install -r requirements.txt
    ```

4. Set your private key as an environment variable:
    - On Linux/Mac OS:
        ```sh
        export HEX_PRIVATE_KEY="your_private_key"
        ```
    - On Windows:
        ```sh
        set HEX_PRIVATE_KEY=your_private_key
        ```
    - On PowerShell:
        ```sh
        $env:HEX_PRIVATE_KEY="your_private_key"
        ```

5. Run the application:
    ```sh
    uvicorn app:app --reload --host 0.0.0.0 --port 443 --ssl-certfile path_to_cert/fullchain.pem --ssl-keyfile path_to_cert/privkey.pem
    ```