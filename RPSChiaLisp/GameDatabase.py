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
        CREATE TABLE IF NOT EXISTS game_data (
            id INTEGER PRIMARY KEY,
            coinId TEXT,
            gameStatus TEXT,
            gameStatusDescription TEXT,
            publicKeyWinner TEXT,
            publicKeyPlayer1 TEXT,
            publicKeyPlayer2 TEXT,
            selectionPlayer1 TEXT,
            selectionPlayer2 TEXT,
            dateGame TEXT,
            timestamp INTEGER,
            gameAmount INTEGER,
            confirmedBlockIndex INTEGER,
            spentBlockIndex INTEGER,
            oracleConfirmedBlockIndex INTEGER
        )
        ''')

        self.conn.commit()
        self.c.execute('''
        CREATE UNIQUE INDEX IF NOT EXISTS idx_coinId ON game_data (coinId)
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
        INSERT INTO game_data (coinId, gameStatus, gameStatusDescription, publicKeyWinner, publicKeyPlayer1, publicKeyPlayer2, selectionPlayer1, selectionPlayer2, dateGame,timestamp, gameAmount, confirmedBlockIndex,spentBlockIndex,oracleConfirmedBlockIndex)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        return result[0] if result else None
    def existsCoinId(self, coinId):
        self.c.execute('''
        SELECT coinId FROM game_data WHERE coinId = ?
        ''', (coinId,))
        if self.c.fetchone():
            return True
        return False
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
