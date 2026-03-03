# Salt & Pepper 🧂🌶️

**Game Design & Concept by:** Ben Dov Bloch  
**Platform:** Web Multiplayer (Hosted on GitHub Pages)

Welcome to **Salt & Pepper**, a strategic 2-player board game where positioning, merging, and defending are the keys to victory!

## 📌 The Board & Setup
* **Grid Size:** The board is a 5x4 grid (5 rows high, 4 columns wide).
* **Player 1 (Salt):** Starts with 4 "Salt" pawns filling the top row.
* **Player 2 (Pepper):** Starts with 4 "Pepper" pawns filling the bottom row.
* **Starting Value:** All pawns start with a power number of **1**.



## 📜 Core Rules

### 1. Movement
* **Direction:** Pawns move in a "plus" manner ➕. You can only move your pawns orthogonally (Up, Down, Left, or Right). Diagonal movement is not allowed.
* **Distance:** A pawn can only move **1 space** per turn.
* **Mandatory Action:** Passing is not allowed. A player **must** make a valid move on their turn.

### 2. Merging (Powering Up)
* If a player moves one of their pawns into a space occupied by another of their own pawns, the two pieces merge.
* Merging two pawns with a power of **1** creates a single pawn with a power of **2**.
* **Maximum Power Limit:** The highest power level a pawn can reach is **2**. Because a power of 3 or higher does not exist, you **cannot** merge a 1 with a 2, nor can you merge two 2s.

### 3. Eating (Capturing)
* You capture an opponent's pawn by stepping into its space.
* **Standard Capture:** To capture a normal pawn, your attacking pawn's number must be **greater than or equal to** (not less than) the opponent's pawn number. (e.g., A 1 can capture a 1, a 2 can capture a 1 or a 2).
* **Capturing a Protector:** The Protector has an advantage in defense! You **cannot** capture a Protector with a pawn of the same number. To capture an opponent's Protector, your attacking pawn's number must be **strictly greater** than the Protector's number (e.g., Only a 2 can capture a level 1 Protector. A level 2 Protector cannot be captured).

### 4. The Protector 🛡️
* A player can transform **1** of their pawns into a "Protector".
* The Protector acts as a roadblock. 
* **Capturing a Protector:** Unlike standard captures, ties do not win against a Protector. An opponent can only eat your Protector if their attacking pawn's number is **strictly bigger** than your Protector's number. If they are not bigger, they cannot move into that space.

### 5. Promotion (End of the Board)
* If a pawn successfully advances all the way to the opponent's starting row (the very last row on the opposite side), it is promoted!
* Upon promotion, the pawn's power number automatically becomes **2** (if it was a 1).

---

## 🚀 How to Play (Development)
*(Instructions on how to run the game locally or link to the live GitHub Pages site will go here.)*


## 💻 Technology Stack

Since this game is hosted on a free domain, the technology stack is designed to be lightweight and run entirely in the browser without expensive servers.

* **Frontend Structure & Styling:** HTML5 & CSS3 (Using CSS Grid to perfectly map out the 5x4 game board).
* **Game Logic:** Vanilla JavaScript (ES6+).
* **Hosting:** [GitHub Pages](https://pages.github.com/). It is completely free, secure, and automatically updates the live game whenever you push code to your GitHub repository.
* **Multiplayer / Networking (PeerJS):** * Because GitHub Pages cannot run dedicated backend servers, the game uses **WebRTC** via the [PeerJS](https://peerjs.com/) library. 
  * This creates a **Peer-to-Peer (P2P)** connection directly between the two players' browsers. Player 1 "hosts" the game and gets a short ID code, and Player 2 enters that code to join. 



* **Version Control:** Git & GitHub.