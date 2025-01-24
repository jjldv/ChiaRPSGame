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
        CREATE TABLE IF NOT EXISTS game_data (
            id INTEGER PRIMARY KEY,
            parentCoinId TEXT,
            coinId TEXT,
            gameStatus TEXT,
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
            coinStatus TEXT
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
        INSERT INTO game_data ( parentCoinId, coinId, gameStatus, gameStatusDescription, publicKeyWinner, publicKeyPlayer1, publicKeyPlayer2, compromisePlayer1, selectionPlayer1, secretKeyPlayer1, emojiSelectionPlayer1, selectionPlayer2, emojiSelectionPlayer2, dateGame, timestamp, gameAmount, confirmedBlockIndex, spentBlockIndex, oracleConfirmedBlockIndex, coinStatus)
        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', data)

        self.conn.commit()

    def topWinners(self):
        self.c.execute('''
        SELECT publicKeyWinner AS player, COUNT(*) AS wins
        FROM game_data
        WHERE (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED' ) AND publicKeyWinner IS NOT NULL
        GROUP BY publicKeyWinner
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
        SELECT publicKeyWinner AS player, SUM(gameAmount) AS total_earned
        FROM game_data
        WHERE (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED' ) AND publicKeyWinner IS NOT NULL
        GROUP BY publicKeyWinner
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
        if current_index is None:
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
        if current_index is None:
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
    def getOpenGames(self):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE  coinStatus = 'UNSPENT'
        ''')
        rows = self.c.fetchall()
        return [dict(row) for row in rows]
    def getUserOpenGames(self, publicKey):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?) AND coinStatus = 'UNSPENT'
        ''', (publicKey, publicKey))
        rows = self.c.fetchall()
        return [dict(row) for row in rows]
    def getHistoryGames(self):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED' OR gameStatus = 'CLOSED' 
        ''')
        rows = self.c.fetchall()
        return [dict(row) for row in rows]
    def getGameDetails(self, coinId):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE coinId = ?
        ''', (coinId,))
        return dict(self.c.fetchone())

    def getCoinsChain(self, coinId):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE coinId IN (
            WITH RECURSIVE coin_chain(id) AS (
                SELECT coinId FROM game_data WHERE coinId = ?
                UNION ALL
                SELECT g.coinId 
                FROM game_data g, coin_chain c
                WHERE g.parentCoinId = c.id
            )
            SELECT * FROM coin_chain
        )
        ORDER BY timestamp ASC
        ''', (coinId,))
        return [dict(row) for row in self.c.fetchall()]
    def getUserHistoryGames(self, publicKey):
        self.c.execute('''
        SELECT * FROM game_data
        WHERE (publicKeyPlayer1 = ? OR publicKeyPlayer2 = ?) AND (gameStatus = 'REVEALED' OR gameStatus = 'CLAIMED' OR gameStatus = 'CLOSED')
        ORDER BY id DESC
        ''', (publicKey, publicKey))
        rows = self.c.fetchall()
        return [dict(row) for row in rows]