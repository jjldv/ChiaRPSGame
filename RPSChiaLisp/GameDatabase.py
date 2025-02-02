import sqlite3
import os

class GameDatabase:
    def __init__(self, db_name='gameData.db'):
        self.db_name = db_name
        self.conn = None
        self.ensure_database()

    def ensure_database(self):
        if not os.path.exists(self.db_name):
            self.createDatabase()
        else:
            self.connect()

    def connect(self):
        self.conn = sqlite3.connect(self.db_name)
        self.conn.row_factory = sqlite3.Row
        self.c = self.conn.cursor()

    def createDatabase(self):
        self.connect()
        self.createTables()

    def createTables(self):
        self.c.execute('''
        CREATE TABLE IF NOT EXISTS sync_index (
            id INTEGER PRIMARY KEY,
            last_block_index INTEGER
        )
        ''')
        self.c.execute('''
        CREATE TABLE IF NOT EXISTS sync_index_open_games (
            id INTEGER PRIMARY KEY,
            last_block_index INTEGER
        )
        ''')

        self.c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            publicKey TEXT UNIQUE,
            firebaseToken TEXT,
            name TEXT
        )
        ''')

        self.c.execute('''
        CREATE TABLE IF NOT EXISTS game_data (
            id INTEGER PRIMARY KEY,
            parentCoinId TEXT,
            coinId TEXT,
            puzzleHash TEXT,
            puzzleReveal TEXT,
            gameStatus TEXT,
            stage INTEGER,
            gameStatusDescription TEXT,
            publicKeyWinner TEXT,
            publicKeyPlayer1 TEXT,
            publicKeyPlayer2 TEXT,
            compromisePlayer1 TEXT,          
            selectionPlayer1 TEXT,
            secretKeyPlayer1 TEXT,
            emojiSelectionPlayer1 TEXT,
            selectionPlayer2 TEXT,
            emojiSelectionPlayer2 TEXT,
            dateGame TEXT,
            timestamp INTEGER,
            gameAmount INTEGER,
            confirmedBlockIndex INTEGER,
            spentBlockIndex INTEGER,
            oracleConfirmedBlockIndex INTEGER,
            coinStatus TEXT,
            isPendingTransaction INTEGER DEFAULT 0
        )
        ''')

        self.conn.commit()
        self.c.execute('''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_coinId ON game_data (coinId)
        ''')
        
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_coin_parent ON game_data (coinId, parentCoinId)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_parentCoinId ON game_data (parentCoinId)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_coinStatus ON game_data (coinStatus)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_confirmedBlockIndex ON game_data (confirmedBlockIndex)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_spentBlockIndex ON game_data (spentBlockIndex)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_publicKeyWinner ON game_data (publicKeyWinner)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_publicKeyPlayer1 ON game_data (publicKeyPlayer1)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_publicKeyPlayer2 ON game_data (publicKeyPlayer2)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_dateGame ON game_data (dateGame)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_timestamp ON game_data (timestamp)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_gameAmount ON game_data (gameAmount)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_gameStatus ON game_data (gameStatus)
        ''')
        self.c.execute('''
        CREATE INDEX IF NOT EXISTS idx_oracleConfirmedBlockIndex ON game_data (oracleConfirmedBlockIndex)
        ''')
        self.conn.commit()

    def close(self):
        if self.conn:
            self.conn.close()

    def insertGameData(self, data):
        self.c.execute('''
        INSERT INTO game_data ( parentCoinId, coinId,puzzleHash,puzzleReveal, gameStatus,stage, gameStatusDescription, publicKeyWinner, publicKeyPlayer1, publicKeyPlayer2, compromisePlayer1, selectionPlayer1, secretKeyPlayer1, emojiSelectionPlayer1, selectionPlayer2, emojiSelectionPlayer2, dateGame, timestamp, gameAmount, confirmedBlockIndex, spentBlockIndex, oracleConfirmedBlockIndex, coinStatus)
        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?,?, ?,?, ?)
        ''', data)

        self.conn.commit()

    def topWinners(self):
        self.c.execute('''
        SELECT COALESCE(u.name, g.publicKeyWinner) AS player,g.publicKeyWinner, COUNT(*) AS wins
        FROM game_data g
        LEFT JOIN users u ON g.publicKeyWinner = u.publicKey
        WHERE (g.gameStatus = 'REVEALED' OR g.gameStatus = 'CLAIMED') AND g.publicKeyWinner IS NOT NULL
        GROUP BY g.publicKeyWinner
        ORDER BY wins DESC
        LIMIT 10
        ''')

        rows = self.c.fetchall()
        return [dict(row) for row in rows]
    def getGamesByPlayer(self, player,page,limit):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE publicKeyWinner = ? ORDER BY id DESC LIMIT ? OFFSET ?
        ''',(player,limit,page*limit))
        rows = self.c.fetchall()
        return [dict(row) for row in rows]
    def getGamesHistory(self,page,limit):
        self.c.execute('''
        SELECT * FROM game_data
        ORDER BY id DESC LIMIT ? OFFSET ?
        ''',(limit,page*limit))
        rows = self.c.fetchall()
        return [dict(row) for row in rows]
    def topEarners(self):
        self.c.execute('''
        SELECT COALESCE(u.name, g.publicKeyWinner) AS player, g.publicKeyWinner, SUM(g.gameAmount / 2) AS total_earned
        FROM game_data g
        LEFT JOIN users u ON g.publicKeyWinner = u.publicKey
        WHERE (g.gameStatus = 'REVEALED' OR g.gameStatus = 'CLAIMED') AND g.publicKeyWinner IS NOT NULL
        GROUP BY g.publicKeyWinner
        ORDER BY total_earned DESC
        LIMIT 10
        ''')

        rows = self.c.fetchall()
        return [dict(row) for row in rows]

    def getLastIndexSync(self):
        self.c.execute('''
        SELECT last_block_index FROM sync_index ORDER BY id DESC LIMIT 1
        ''')
        result = self.c.fetchone()
        return result[0] if result else 0
    def getLastIndexSyncOpenGames(self):
        self.c.execute('''
        SELECT last_block_index FROM sync_index_open_games ORDER BY id DESC LIMIT 1
        ''')
        result = self.c.fetchone()
        return result[0] if result else 0
    def existsCoinId(self, coinId):
        self.c.execute('''
        SELECT coinId FROM game_data WHERE coinId = ?
        ''', (coinId,))
        if self.c.fetchone():
            return True
    def existsCoinIdAndIsUnspent(self, coinId):
        self.c.execute('''
        SELECT coinId FROM game_data WHERE coinId = ? AND coinStatus = 'UNSPENT'
        ''', (coinId,))
        if self.c.fetchone():
            return True
        return False
    def deleteCoinId(self, coinId):
        self.c.execute('''
        DELETE FROM game_data WHERE coinId = ?
        ''', (coinId,))
        self.conn.commit()
        return self.c.rowcount > 0
    def setSpentCoinId(self, coinId):
        self.c.execute('''
        UPDATE game_data SET coinStatus = 'SPENT' WHERE coinId = ? 
        ''', (coinId,))
        self.conn.commit()
        return self.c.rowcount > 0
    def updateLastIndexSync(self, new_index):
        new_index = new_index + 1
        current_index = self.getLastIndexSync()
        if current_index == 0:
            self.c.execute('''
            INSERT INTO sync_index (last_block_index) VALUES (?)
            ''', (new_index,))
        elif new_index > current_index:
            self.c.execute('''
            UPDATE sync_index SET last_block_index = ? WHERE id = (
                SELECT id FROM sync_index ORDER BY id DESC LIMIT 1
            )
            ''', (new_index,))
        self.conn.commit()
    def updateLastIndexSyncOpenGames(self, new_index):
        new_index = new_index + 1
        current_index = self.getLastIndexSyncOpenGames()
        if current_index == 0:
            self.c.execute('''
            INSERT INTO sync_index_open_games (last_block_index) VALUES (?)
            ''', (new_index,))
        elif new_index > current_index:
            self.c.execute('''
            UPDATE sync_index_open_games SET last_block_index = ? WHERE id = (
                SELECT id FROM sync_index_open_games ORDER BY id DESC LIMIT 1
            )
            ''', (new_index,))
        self.conn.commit()
    def getOpenGames(self, limit=1000):
        self.c.execute('''
            SELECT 
                g.coinId,
                g.dateGame,
                g.publicKeyPlayer1,
                g.publicKeyPlayer2,
                COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1,
                COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2,
                g.selectionPlayer1 as player1_move,
                g.selectionPlayer2 as player2_move,
                g.emojiSelectionPlayer1 as player1_emoji,
                g.emojiSelectionPlayer2 as player2_emoji,
                g.publicKeyWinner,
                g.gameAmount  as bet_amount,
                CASE WHEN g.coinStatus = 'UNSPENT' THEN 'OPEN' ELSE g.gameStatus END as game_status,
                g.gameStatusDescription
            FROM game_data g
            LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
            LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
            WHERE g.coinStatus = 'UNSPENT' and g.stage = 2
            ORDER BY g.timestamp DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in self.c.fetchall()]
    def getUserOpenGames(self, publicKey, limit=1000):
        self.c.execute('''
            SELECT 
                g.coinId,
                g.dateGame,
                g.publicKeyPlayer1,
                g.publicKeyPlayer2,
                COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1,
                COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2,
                NULLIF(CASE WHEN g.publicKeyPlayer1 = ? THEN g.selectionPlayer1 ELSE g.selectionPlayer2 END,
                    CASE WHEN g.coinStatus = 'UNSPENT' OR (g.publicKeyPlayer1 = ? AND g.gameStatus = 'CLAIMED') 
                    THEN g.selectionPlayer1 END) as player_move,
                CASE 
                    WHEN g.coinStatus = 'UNSPENT' THEN '❓'
                    ELSE NULLIF(CASE WHEN g.publicKeyPlayer1 = ? THEN g.emojiSelectionPlayer1 ELSE g.emojiSelectionPlayer2 END,
                        CASE WHEN g.coinStatus = 'UNSPENT' OR (g.publicKeyPlayer1 = ? AND g.gameStatus = 'CLAIMED') 
                        THEN g.emojiSelectionPlayer1 END)
                END as player_emoji,
                CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END as opponent_key,
                COALESCE(u.name, CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END) as opponent_name,
                g.publicKeyWinner,
                g.gameAmount  as bet_amount,
                CASE WHEN g.coinStatus = 'UNSPENT' THEN 'OPEN' ELSE g.gameStatus END as game_status,
                g.gameStatusDescription
            FROM game_data g
            LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
            LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
            LEFT JOIN users u ON u.publicKey = CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END
            WHERE (g.publicKeyPlayer1 = ? OR g.publicKeyPlayer2 = ?)
            AND g.coinStatus = 'UNSPENT'
            ORDER BY g.timestamp DESC
            LIMIT ?
        ''', (publicKey,)*9 + (limit,))
        return [dict(row) for row in self.c.fetchall()]
    def getHistoryGames(self, limit=1000):
        self.c.execute('''
            SELECT 
                g.coinId,
                g.dateGame,
                g.publicKeyPlayer1,
                g.publicKeyPlayer2,
                COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1,
                COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2,
                g.selectionPlayer1 as player1_move,
                g.selectionPlayer2 as player2_move,
                g.emojiSelectionPlayer1 as player1_emoji,
                g.emojiSelectionPlayer2 as player2_emoji,
                g.publicKeyWinner,
                g.gameAmount  as bet_amount,
                CASE WHEN g.coinStatus = 'UNSPENT' THEN 'OPEN' ELSE g.gameStatus END as game_status,
                g.gameStatusDescription
            FROM game_data g
            LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
            LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
            WHERE g.gameStatus IN ('REVEALED', 'CLAIMED') AND g.coinStatus = 'SPENT'
            ORDER BY g.timestamp DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in self.c.fetchall()]
    def getGameDetails(self, coinId):
        self.c.execute('''
        SELECT g.*, 
               COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1, 
               COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2
        FROM game_data g
        LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
        LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
        WHERE g.coinId = ?
        ''', (coinId,))
        return dict(self.c.fetchone())

    def getCoinsChain(self, coinId):
        self.c.execute('''
        WITH RECURSIVE chain AS (
            -- Encuentra el nodo inicial y todos sus ancestros
            WITH RECURSIVE ancestors AS (
            SELECT * FROM game_data WHERE coinId = ?
            UNION ALL
            SELECT g.* FROM game_data g
            INNER JOIN ancestors a ON g.coinId = a.parentCoinId
            ),
            -- Encuentra todos los descendientes
            descendants AS (
            SELECT * FROM game_data WHERE coinId = ?
            UNION ALL
            SELECT g.* FROM game_data g
            INNER JOIN descendants d ON g.parentCoinId = d.coinId
            )
            -- Une ancestros y descendientes
            SELECT * FROM ancestors
            UNION
            SELECT * FROM descendants
        )
        SELECT DISTINCT g.*, 
               COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1, 
               COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2
        FROM chain g
        LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
        LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
        ORDER BY g.timestamp ASC
        ''', (coinId, coinId))
        return [dict(row) for row in self.c.fetchall()]
    def getUserHistoryGames(self, publicKey, limit=1000):
        self.c.execute('''
            SELECT 
                g.coinId,
                g.dateGame,
                g.publicKeyPlayer1,
                g.publicKeyPlayer2,
                COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1,
                COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2,
                NULLIF(CASE WHEN g.publicKeyPlayer1 = ? THEN g.selectionPlayer1 ELSE g.selectionPlayer2 END,
                    CASE WHEN g.coinStatus = 'UNSPENT' OR (g.publicKeyPlayer1 = ? AND g.gameStatus = 'CLAIMED') 
                    THEN g.selectionPlayer1 END) as player_move,
                CASE 
                    WHEN g.coinStatus = 'UNSPENT' THEN '❓'
                    ELSE NULLIF(CASE WHEN g.publicKeyPlayer1 = ? THEN g.emojiSelectionPlayer1 ELSE g.emojiSelectionPlayer2 END,
                        CASE WHEN g.coinStatus = 'UNSPENT' OR (g.publicKeyPlayer1 = ? AND g.gameStatus = 'CLAIMED') 
                        THEN g.emojiSelectionPlayer1 END)
                END as player_emoji,
                CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END as opponent_key,
                COALESCE(u.name, CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END) as opponent_name,
                g.publicKeyWinner,
                g.gameAmount  as bet_amount,
                CASE WHEN g.coinStatus = 'UNSPENT' THEN 'OPEN' ELSE g.gameStatus END as game_status,
                g.gameStatusDescription
            FROM game_data g
            LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
            LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
            LEFT JOIN users u ON u.publicKey = CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END
            WHERE (g.publicKeyPlayer1 = ? OR g.publicKeyPlayer2 = ?)
            AND (g.gameStatus IN ('REVEALED', 'CLAIMED', 'CLOSED') AND g.coinStatus = 'SPENT')
            ORDER BY g.timestamp DESC
            LIMIT ?
        ''', (publicKey,)*9 + (limit,))
        return [dict(row) for row in self.c.fetchall()]
    def setUserName(self, publicKey, name):
        self.c.execute('''
        INSERT OR REPLACE INTO users (publicKey, name) VALUES (?, ?)
        ''', (publicKey, name))
        self.conn.commit()
        return self.c.rowcount > 0
    def getUserName(self, publicKey):
        self.c.execute('''
        SELECT name FROM users WHERE publicKey = ?
        ''', (publicKey,))
        result = self.c.fetchone()
        return result[0] if result else publicKey
    def setFirebaseToken(self, publicKey, token):
        self.c.execute('''
        UPDATE users SET firebaseToken = ? WHERE publicKey = ?
        ''', (token, publicKey))
        if self.c.rowcount == 0:
            self.c.execute('''
            INSERT INTO users (publicKey, firebaseToken) VALUES (?, ?)
            ''', (publicKey, token))
        self.conn.commit()
        return self.c.rowcount > 0
    def getTokenFromPublicKey(self, publicKey):
        self.c.execute('''
        SELECT firebaseToken FROM users WHERE publicKey = ?
        ''', (publicKey,))
        result = self.c.fetchone()
        return result[0] if result else None
    def isPendingTransaction(self, coinId):
        self.c.execute('''
        SELECT isPendingTransaction FROM game_data WHERE coinId = ? AND isPendingTransaction = 1
        ''', (coinId,))
        result = self.c.fetchone()
        return result[0] if result else False
    def setPendingTransaction(self, coinId):
        self.c.execute('''
        UPDATE game_data SET isPendingTransaction = 1 WHERE coinId = ?
        ''', (coinId,))
        self.conn.commit()
        return self.c.rowcount > 0
    def setNotPendingTransaction(self, coinId):
        self.c.execute('''
        UPDATE game_data SET isPendingTransaction = 0 WHERE coinId = ?
        ''', (coinId,))
        self.conn.commit()
        return self.c.rowcount > 0
    def getCoin(self, coinId):
        self.c.execute('''
        SELECT g.*, 
               COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1, 
               COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2
        FROM game_data g
        LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
        LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
        WHERE g.coinId = ?
        ''', (coinId,))
        result = self.c.fetchone()
        return dict(result) if result else None
    def getPlayerTotalCompletedGames(self, publicKey):
        self.c.execute('''
            SELECT COUNT(*) as total FROM game_data 
            WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?) 
            AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
        ''', (publicKey, publicKey))
        return self.c.fetchone()['total']
    def getPlayerTotalOpenGames(self, publicKey):
        self.c.execute('''
            SELECT COUNT(*) as total FROM game_data 
            WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?) 
            AND coinStatus = 'UNSPENT'
        ''', (publicKey, publicKey))
        return self.c.fetchone()['total']
    def getPlayerWinLossRecord(self, publicKey):
        self.c.execute('''
            SELECT 
                COUNT(CASE WHEN publicKeyWinner = ? THEN 1 END) as wins,
                COUNT(CASE WHEN publicKeyWinner IS NOT NULL AND publicKeyWinner != ? THEN 1 END) as losses,
                COUNT(CASE WHEN publicKeyWinner IS NULL AND (gameStatus = 'REVEALED' ) THEN 1 END) as draws
            FROM game_data 
            WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?)
            AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
        ''', (publicKey, publicKey, publicKey, publicKey))
        return dict(self.c.fetchone())

    def getPlayerMoveStats(self, publicKey):
        """Get player's move statistics, excluding claimed games where player1 didn't reveal"""
        self.c.execute('''
            SELECT move, COUNT(*) as times_used FROM (
                SELECT selectionPlayer2 as move
                FROM game_data 
                WHERE publicKeyPlayer2 = ? 
                AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
                UNION ALL
                SELECT selectionPlayer1 as move
                FROM game_data 
                WHERE publicKeyPlayer1 = ? 
                AND gameStatus = 'REVEALED'
            )
            GROUP BY move
            ORDER BY times_used DESC
        ''', (publicKey, publicKey))
        return [dict(row) for row in self.c.fetchall()]

    def getPlayerAmountStats(self, publicKey):
        """Get player's amount statistics, dividing gameAmount by 2 since each player contributes half"""
        self.c.execute('''
            WITH WinningGames AS (
                SELECT 
                    coinId,
                    gameAmount/2 as win_amount
                FROM game_data 
                WHERE publicKeyWinner = ?
                AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
                ORDER BY gameAmount DESC
                LIMIT 1
            )
            SELECT 
                SUM(CASE WHEN publicKeyWinner = ? THEN gameAmount/2 ELSE 0 END) as total_won,
                SUM(CASE WHEN publicKeyWinner != ? AND publicKeyWinner IS NOT NULL THEN gameAmount/2 ELSE 0 END) as total_lost,
                AVG(gameAmount/2) as avg_bet,
                wg.win_amount as biggest_win,
                wg.coinId as coinId_biggest_win
            FROM game_data 
            LEFT JOIN WinningGames wg ON 1=1
            WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?)
            AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
            GROUP BY wg.win_amount, wg.coinId
        ''', (publicKey, publicKey, publicKey, publicKey, publicKey))
        return dict(self.c.fetchone())

    def getPlayerWinStreak(self, publicKey):
        """Get player's longest win streak"""
        self.c.execute('''
            WITH RankedGames AS (
                SELECT 
                    dateGame,
                    publicKeyWinner,
                    dateGame - LAG(dateGame) OVER (ORDER BY dateGame) as date_diff,
                    publicKeyWinner = LAG(publicKeyWinner) OVER (ORDER BY dateGame) as same_winner
                FROM game_data
                WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?)
                AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
                ORDER BY dateGame
            ),
            Streaks AS (
                SELECT
                    dateGame,
                    CASE 
                        WHEN publicKeyWinner = ? THEN 1
                        ELSE 0
                    END as is_win,
                    CASE 
                        WHEN publicKeyWinner = ? AND 
                            LAG(publicKeyWinner) OVER (ORDER BY dateGame) = ? AND
                            same_winner = 1
                        THEN 0
                        ELSE 1
                    END as streak_start
                FROM RankedGames
            ),
            StreakGroups AS (
                SELECT
                    dateGame,
                    is_win,
                    SUM(streak_start) OVER (ORDER BY dateGame) as streak_group
                FROM Streaks
                WHERE is_win = 1
            )
            SELECT COALESCE(MAX(streak_length), 0) as max_streak
            FROM (
                SELECT streak_group, COUNT(*) as streak_length
                FROM StreakGroups
                GROUP BY streak_group
            )
        ''', (publicKey, publicKey, publicKey, publicKey, publicKey))
        
        result = self.c.fetchone()
        return result['max_streak'] if result else 0

    def getMostPlayedAgainst(self, publicKey):
        """Get opponent most played against with their name if available"""
        self.c.execute('''
            SELECT 
            opponent_key as opponent,
            COALESCE(u.name, 'Anonymous') as opponent_name,
            games_played
            FROM (
            SELECT 
                CASE 
                WHEN publicKeyPlayer1 = ? THEN publicKeyPlayer2
                ELSE publicKeyPlayer1 
                END as opponent_key,
                COUNT(*) as games_played
            FROM game_data 
            WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?)
            AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
            GROUP BY opponent_key
            ORDER BY games_played DESC
            LIMIT 1
            ) most_played
            LEFT JOIN users u ON u.publicKey = opponent_key
        ''', (publicKey, publicKey, publicKey))
        result = self.c.fetchone()
        return dict(result) if result else None

    def getPlayerFirstGame(self, publicKey):
        """Get date of player's first game"""
        self.c.execute('''
            SELECT MIN(dateGame) as first_game
            FROM game_data 
            WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?)
        ''', (publicKey, publicKey))
        return self.c.fetchone()['first_game']

    def getRecentGames(self, publicKey, limit=10):
        self.c.execute('''
            SELECT 
                g.coinId,
                g.dateGame,
                g.publicKeyPlayer1,
                g.publicKeyPlayer2,
                COALESCE(u1.name, g.publicKeyPlayer1) AS namePlayer1,
                COALESCE(u2.name, g.publicKeyPlayer2) AS namePlayer2,
                NULLIF(CASE WHEN g.publicKeyPlayer1 = ? THEN g.selectionPlayer1 ELSE g.selectionPlayer2 END,
                    CASE WHEN g.coinStatus = 'UNSPENT' OR (g.publicKeyPlayer1 = ? AND g.gameStatus = 'CLAIMED') 
                    THEN g.selectionPlayer1 END) as player_move,
                CASE 
                    WHEN g.coinStatus = 'UNSPENT' THEN '❓'
                    ELSE NULLIF(CASE WHEN g.publicKeyPlayer1 = ? THEN g.emojiSelectionPlayer1 ELSE g.emojiSelectionPlayer2 END,
                        CASE WHEN g.coinStatus = 'UNSPENT' OR (g.publicKeyPlayer1 = ? AND g.gameStatus = 'CLAIMED') 
                        THEN g.emojiSelectionPlayer1 END)
                END as player_emoji,
                CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END as opponent_key,
                COALESCE(u.name, CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END) as opponent_name,
                g.publicKeyWinner,
                g.gameAmount  as bet_amount,
                CASE WHEN g.coinStatus = 'UNSPENT' THEN 'OPEN' ELSE g.gameStatus END as game_status,
                g.gameStatusDescription
            FROM game_data g
            LEFT JOIN users u1 ON g.publicKeyPlayer1 = u1.publicKey
            LEFT JOIN users u2 ON g.publicKeyPlayer2 = u2.publicKey
            LEFT JOIN users u ON u.publicKey = CASE WHEN g.publicKeyPlayer1 = ? THEN g.publicKeyPlayer2 ELSE g.publicKeyPlayer1 END
            WHERE (g.publicKeyPlayer1 = ? OR g.publicKeyPlayer2 = ?)
            AND (g.gameStatus IN ('REVEALED', 'CLAIMED') OR g.coinStatus = 'UNSPENT')
            ORDER BY g.timestamp DESC
            LIMIT ?
        ''', (publicKey,)*9 + (limit,))
        return [dict(row) for row in self.c.fetchall()]
    def getPlayerRank(self, publicKey):
        """Get player's rank based on number of wins"""
        self.c.execute('''
            WITH WinCounts AS (
                SELECT 
                    CASE 
                        WHEN publicKeyPlayer1 = winner.publicKey THEN publicKeyPlayer1
                        ELSE publicKeyPlayer2
                    END as player,
                    COUNT(*) as wins
                FROM (
                    SELECT 
                        publicKeyPlayer1,
                        publicKeyPlayer2,
                        publicKeyWinner as publicKey
                    FROM game_data 
                    WHERE (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED')
                    AND publicKeyWinner IS NOT NULL
                ) winner
                GROUP BY player
            ),
            Rankings AS (
                SELECT 
                    player,
                    wins,
                    DENSE_RANK() OVER (ORDER BY wins DESC) as rank
                FROM WinCounts
            )
            SELECT rank, wins
            FROM Rankings
            WHERE player = ?
        ''', (publicKey,))
        
        result = self.c.fetchone()
        return {'rank': result['rank'], 'total_wins': result['wins']} if result else {'rank': 0, 'total_wins': 0}
    def getGlobalStats(self):
        """Get global platform statistics"""
        self.c.execute('''
            WITH BiggestGame AS (
            SELECT coinId, gameAmount
            FROM game_data
            ORDER BY gameAmount DESC
            LIMIT 1
            )
            SELECT 
            SUM(CASE WHEN g.gameStatus IN ('REVEALED', 'CLAIMED') THEN 1 ELSE 0 END) as total_completed_games,
            SUM(g.gameAmount) as total_volume,
            COUNT(DISTINCT publicKeyPlayer1) + COUNT(DISTINCT publicKeyPlayer2) as total_players,
            AVG(g.gameAmount) as avg_bet,
            bg.gameAmount as biggest_game,
            bg.coinId as coinId_biggest_game,
            SUM(CASE WHEN g.coinStatus = 'UNSPENT' AND g.stage = 2 THEN 1 ELSE 0 END) as total_open_games
            FROM game_data g
            LEFT JOIN BiggestGame bg ON 1=1
        ''')
        return dict(self.c.fetchone())

    def getTopWinners(self, limit=10):
        """Get top players by number of wins"""
        self.c.execute('''
            WITH PlayerWins AS (
                SELECT 
                    publicKeyWinner as player,
                    COUNT(*) as wins,
                    SUM(gameAmount/2) as amount_won
                FROM game_data 
                WHERE gameStatus IN ('REVEALED', 'CLAIMED')
                AND publicKeyWinner IS NOT NULL
                GROUP BY publicKeyWinner
            )
            SELECT 
                w.player,
                COALESCE(u.name, w.player) as player_name,
                w.wins,
                w.amount_won
            FROM PlayerWins w
            LEFT JOIN users u ON u.publicKey = w.player
            ORDER BY w.wins DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in self.c.fetchall()]

    def getTopEarners(self, limit=10):
        """Get top players by amount earned"""
        self.c.execute('''
            WITH PlayerEarnings AS (
                SELECT 
                    p.player,
                    SUM(CASE WHEN g.publicKeyWinner = p.player THEN g.gameAmount/2 ELSE 0 END) as total_won,
                    SUM(CASE WHEN g.publicKeyWinner != p.player AND g.publicKeyWinner IS NOT NULL THEN g.gameAmount/2 ELSE 0 END) as total_lost,
                    COUNT(*) as total_games
                FROM (
                    SELECT DISTINCT 
                        CASE 
                            WHEN publicKeyPlayer1 IS NOT NULL THEN publicKeyPlayer1 
                            ELSE publicKeyPlayer2 
                        END as player
                    FROM game_data
                ) p
                JOIN game_data g ON (g.publicKeyPlayer1 = p.player OR g.publicKeyPlayer2 = p.player)
                WHERE g.gameStatus IN ('REVEALED', 'CLAIMED')
                GROUP BY p.player
            )
            SELECT 
                e.player,
                COALESCE(u.name, e.player) as player_name,
                e.total_won - e.total_lost as net_earnings,
                e.total_games
            FROM PlayerEarnings e
            LEFT JOIN users u ON u.publicKey = e.player
            ORDER BY net_earnings DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in self.c.fetchall()]

    def getMoveStatistics(self):
        """Get global statistics about move usage"""
        self.c.execute('''
            WITH MoveCounts AS (
                SELECT 
                    CASE 
                        WHEN publicKeyPlayer1 = publicKeyWinner THEN selectionPlayer1
                        WHEN publicKeyPlayer2 = publicKeyWinner THEN selectionPlayer2
                    END as winning_move,
                    COUNT(*) as times_won
                FROM game_data
                WHERE gameStatus = 'REVEALED'
                AND publicKeyWinner IS NOT NULL
                GROUP BY winning_move
            )
            SELECT 
                winning_move,
                times_won,
                ROUND(times_won * 100.0 / SUM(times_won) OVER (), 1) as win_percentage
            FROM MoveCounts
            ORDER BY times_won DESC
        ''')
        return [dict(row) for row in self.c.fetchall()]
    async def getPlayerName(self, publicKey):
        self.c.execute('''
        SELECT name FROM users WHERE publicKey = ?
        ''', (publicKey,))
        result = self.c.fetchone()
        return result[0] if result else publicKey