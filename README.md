# Salt & Pepper 🧂🌶️

**Game Design & Concept by:** Ben Dov Bloch  
**Platform:** Web Multiplayer (Hosted on GitHub Pages)

Welcome to **Salt & Pepper**, a strategic 2-player board game where positioning, merging, and defending are the keys to victory!

## 📌 The Board & Setup
* **Grid Size:** The board is a 5x4 grid (5 rows high, 4 columns wide).
* **Player 1 (Salt):** Starts with 4 "Salt" pawns filling the top row.
* **Player 2 (Pepper):** Starts with 4 "Pepper" pawns filling the bottom row.
* **Starting State:** All pawns begin the game with a power number of **1**, are **unpromoted**, and start in the **attacker** stance.

---

## 📜 Core Rules

### 1. The Action System
Passing is not allowed. A player **must** make a valid move on their turn. Every turn, you may choose exactly **one** of the following actions to perform:

* **Move:** Move an attacker pawn **1 space** orthogonally (Up, Down, Left, or Right) into an empty space, or a space occupied by an attacker (ally or enemy) with a power equal to or lower than the moving pawn. Diagonal movement is not allowed.
* **Merge (Power Up):** Move an attacker pawn into a space occupied by another of your own attacker pawn to combine them.
  * Merging two pawns creates a single pawn with a power of **2**.
  * **Maximum Power Limit:** 2. You cannot merge a 1 with a 2, nor can you merge two 2s.
* **Unmerge (Diverge):** An **attacker** with a power of **2** can split into two pawns of power **1**.
  * One pawn remains in the original spot.
  * The second pawn must be placed in an available adjacent spot (Up, Down, Left, or Right). An "available spot" can be an empty space, a space occupied by your own attacker pawn with a power of **1** (which immediately causes a **Merge**), or a space occupied by an opponent's attacker pawn with a power of **1** (which immediately causes a **Capture**). If no such adjacent spots are available, this action cannot be performed.
  * *Promotion Tracking:* When unmerging, the resulting pawns depend on the composition of the original 2:
    * A 2 made of two promoted 2 (from reaching the end row) unmerges into **1 promoted + 1 promoted**.
    * A 2 made of two unpromoted pawns unmerges into **1 unpromoted + 1 unpromoted**.
    * A 2 made of mixed pawns unmerges into **1 unpromoted + 1 promoted**.
  * *Unmerging onto the Enemy Line:* If the second pawn's resulting location lands on the opponent's starting row, it promotes (instantly becoming a 2 promoted). This only applies if the starting 2 contained an unpromoted part:
    * If the starting 2 was completely unpromoted: the final result is **1 unpromoted + 2 promoted**.
    * If the starting 2 was mixed (unpromoted/promoted): the final result is **1 promoted + 2 promoted**.
    * If there was an enemy attacker of any kind in that spot, it will be captured.
* **Become Defender:** Switch an attacker pawn into the defender stance. *Note: Only a pawn with a power of **1** can become a defender.*
* **Become Attacker:** Switch a defender pawn back into the attacker stance.

### 2. Capturing (Eating)
Capturing is **not** a separate action. Instead, it is the **result** of a movement action (such as a standard Move or placing the second pawn during an Unmerge). You capture an opponent's pawn by moving into its space, provided you meet the power requirements:
* **Capturing an Attacker:** To capture an opponent's attacker, your moving pawn's number must be **greater than or equal to** the opponent's number (e.g., a 1 can eat a 1; a 2 can eat a 1 or a 2).
* **Defenders are Invincible:** You **cannot** capture a defender under any circumstances. A defender acts as an absolute roadblock. You cannot move into or capture a space occupied by an opponent's defender.

### 3. Promotion & Unpromotion
Every power-1 pawn has a property of being either **promoted** or **unpromoted**. Because a power-2 pawn is combined from two power-1 pawns, it retains the properties of its parts. A power-2 pawn can be: **2 unpromoted**, **mixed (1 unpromoted / 1 promoted)**, or **2 promoted**.

Promotion occurs when reaching the opponent's starting row (the last row on the opposite side) and follows these specific outcomes:
* **Using a 1 Attacker (Unpromoted):** If it reaches the end row using the **Move** action, it automatically promotes into a **2 promoted**.
* **Using a 2 Attacker (2 Unpromoted):** If it reaches the end row using the **Move** or **Unmerge** action, the pawn arriving at the end row promotes into a **2 promoted**, leaving a **1 unpromoted** behind in the original spot.
* **Using a 2 Attacker (Mixed Unpromoted/Promoted):** If it reaches the end row using the **Move** or **Unmerge** action, the pawn arriving at the end row promotes into a **2 promoted**, leaving a **1 promoted** behind in the original spot.
* **Unpromotion:** If a promoted pawn wishes to revert to being unpromoted, it must travel all the way back to its own starting row.
---

## 🚀 Play the Game (Live Development Build)
Want to jump in and test the mechanics? The latest playable version of **Salt & Pepper** is hosted live on GitHub Pages. 

Grab a friend and check it out here: 
👉 [https://oribraverman.github.io/Salt-And-Peper/](https://oribraverman.github.io/Salt-And-Peper/)

## 💻 Technology Stack

Since this game is hosted on a free domain, the technology stack is designed to be lightweight and run entirely in the browser without expensive servers.

* **Frontend Structure & Styling:** HTML5 & CSS3 (Using CSS Grid to perfectly map out the 5x4 game board).
* **Game Logic:** Vanilla JavaScript (ES6+).
* **Hosting:** [GitHub Pages](https://pages.github.com/). It is completely free, secure, and automatically updates the live game whenever you push code to your GitHub repository.
* **Multiplayer / Networking (PeerJS):** Because GitHub Pages cannot run dedicated backend servers, the game uses **WebRTC** via the [PeerJS](https://peerjs.com/) library. 
  * This creates a **Peer-to-Peer (P2P)** connection directly between the two players' browsers. Player 1 "hosts" the game and gets a short ID code, and Player 2 enters that code to join. 
* **Version Control:** Git & GitHub.