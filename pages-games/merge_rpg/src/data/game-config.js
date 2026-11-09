// Local game state. Edit this object for local starting values.
window.gameConfig = {
  "round": 1,
  "playerHp": 100,
  "maxHp": 100,
  "score": 0,
  "tutorial": "true",
  "items": [
    {
      "id": "item_dagger_1",
      "type": "dagger",
      "tier": 1,
      "stats": {
        "attack": 4,
        "name": "Ржавый меч"
      }
    },
    {
      "id": "item_armor_1",
      "type": "armor",
      "tier": 1,
      "stats": {
        "defense": 3,
        "name": "Кожаная броня"
      }
    },
    {
      "id": "item_potion_1",
      "type": "potion",
      "tier": 1,
      "stats": {
        "healing": 22,
        "name": "Малое зелье"
      }
    },
    {
      "id": "item_magic_1",
      "type": "magic",
      "tier": 1,
      "stats": {
        "magic": 6,
        "name": "Деревянная палочка"
      }
    }
  ],
  "gridWidth": 6,
  "gridHeight": "6",
  "expansions": "0",
  "advancedItemCoefficient": 0.07,
  "monsterHpGrowth": 0.25,
  "monsterAttackGrowth": "0.20",
  "monsterDefenseGrowth": "0.18",
  "selectedItemType": "potion",
  "selectedItemTier": 8,
  "selectedRound": 1,
  "levelConfig": {
    "maxRounds": "30",
    "rounds": {
      "1": {
        "enemyType": "weak",
        "customHp": 30,
        "customAttack": 6,
        "customPhysDef": 2,
        "customMagicDef": 1
      },
      "2": "{\"enemyType\":\"weak\",\"customHp\":32,\"customAttack\":8,\"customPhysDef\":4,\"customMagicDef\":2}",
      "3": {
        "enemyType": "weak",
        "customHp": 60,
        "customAttack": 12,
        "customPhysDef": 4,
        "customMagicDef": 2
      },
      "4": {
        "enemyType": "weak",
        "customHp": 135,
        "customAttack": 24,
        "customPhysDef": 9,
        "customMagicDef": 6
      },
      "5": "{\"enemyType\": \"weak\", \"customHp\": 165, \"customAttack\": 30, \"customPhysDef\": 12, \"customMagicDef\": 6}",
      "6": "{\"enemyType\": \"medium\", \"customHp\": 195, \"customAttack\": 36, \"customPhysDef\": 15, \"customMagicDef\": 9}",
      "7": "{\"enemyType\": \"strong\", \"customHp\": 240, \"customAttack\": 45, \"customPhysDef\": 18, \"customMagicDef\": 12}",
      "8": "{\"enemyType\": \"strong\", \"customHp\": 285, \"customAttack\": 54, \"customPhysDef\": 21, \"customMagicDef\": 15}",
      "9": "{\"enemyType\": \"strong\", \"customHp\": 330, \"customAttack\": 60, \"customPhysDef\": 24, \"customMagicDef\": 18}",
      "10": "{\"enemyType\": \"troll\", \"customHp\": 390, \"customAttack\": 69, \"customPhysDef\": 30, \"customMagicDef\": 21}",
      "11": "{\"enemyType\": \"strong\", \"customHp\": 435, \"customAttack\": 75, \"customPhysDef\": 27, \"customMagicDef\": 24}",
      "12": "{\"enemyType\": \"lich\", \"customHp\": 480, \"customAttack\": 84, \"customPhysDef\": 24, \"customMagicDef\": 45}",
      "13": "{\"enemyType\": \"strong\", \"customHp\": 525, \"customAttack\": 93, \"customPhysDef\": 33, \"customMagicDef\": 30}",
      "14": "{\"enemyType\": \"strong\", \"customHp\": 570, \"customAttack\": 99, \"customPhysDef\": 39, \"customMagicDef\": 33}",
      "15": "{\"enemyType\": \"demon\", \"customHp\": 600, \"customAttack\": 105, \"customPhysDef\": 45, \"customMagicDef\": 36}",
      "16": "{\"enemyType\": \"strong\", \"customHp\": 645, \"customAttack\": 114, \"customPhysDef\": 48, \"customMagicDef\": 42}",
      "17": "{\"enemyType\": \"strong\", \"customHp\": 690, \"customAttack\": 123, \"customPhysDef\": 54, \"customMagicDef\": 48}",
      "18": "{\"enemyType\": \"ancient_dragon\", \"customHp\": 750, \"customAttack\": 135, \"customPhysDef\": 60, \"customMagicDef\": 54}",
      "19": "{\"enemyType\": \"strong\", \"customHp\": 825, \"customAttack\": 150, \"customPhysDef\": 66, \"customMagicDef\": 63}",
      "20": {
        "enemyType": "void_lord",
        "customHp": 1500,
        "customAttack": 275,
        "customPhysDef": 40,
        "customMagicDef": "40"
      },
      "21": {
        "enemyType": "void_lord",
        "customHp": 1600,
        "customAttack": 290,
        "customPhysDef": 45,
        "customMagicDef": 45
      },
      "22": "{\"enemyType\": \"void_lord\", \"customHp\": 1700, \"customAttack\": 305, \"customPhysDef\": 50, \"customMagicDef\": 50}",
      "23": "{\"enemyType\": \"void_lord\", \"customHp\": 1800, \"customAttack\": 320, \"customPhysDef\": 55, \"customMagicDef\": 55}",
      "24": {
        "enemyType": "void_lord",
        "customHp": 1900,
        "customAttack": 335,
        "customPhysDef": 60,
        "customMagicDef": 60
      },
      "25": "{\"enemyType\": \"void_lord\", \"customHp\": 2000, \"customAttack\": 350, \"customPhysDef\": 65, \"customMagicDef\": 65}",
      "26": "{\"enemyType\": \"void_lord\", \"customHp\": 2250, \"customAttack\": 390, \"customPhysDef\": 70, \"customMagicDef\": 70}",
      "27": "{\"enemyType\": \"void_lord\", \"customHp\": 2500, \"customAttack\": 430, \"customPhysDef\": 75, \"customMagicDef\": 75}",
      "28": "{\"enemyType\": \"void_lord\", \"customHp\": 2750, \"customAttack\": 470, \"customPhysDef\": 80, \"customMagicDef\": 80}",
      "29": "{\"enemyType\": \"void_lord\", \"customHp\": 3000, \"customAttack\": 510, \"customPhysDef\": 85, \"customMagicDef\": 85}",
      "30": {
        "enemyType": "void_lord",
        "customHp": 3500,
        "customAttack": 600,
        "customPhysDef": 100,
        "customMagicDef": 100
      }
    }
  },
  "maxGridWidth": "5",
  "maxGridHeight": "5",
  "itemSpawnConfig": {
    "itemTypeWeights": "{\"dagger\": 1, \"armor\": 1, \"potion\": 1, \"magic\": 1}",
    "tierProbabilities": [
      0.4,
      0.3,
      0.15,
      0.08,
      0.04,
      0.02,
      0.008,
      0.002
    ]
  },
  "itemStats": {
    "dagger": {
      "1": {
        "attack": 5,
        "name": "Ржавый меч"
      },
      "2": {
        "attack": 8,
        "name": "Железный меч"
      },
      "3": {
        "attack": 11,
        "name": "Эльфийский меч"
      },
      "4": {
        "attack": 15,
        "name": "Обсидиановый меч"
      },
      "5": {
        "attack": 20,
        "name": "Гномий меч"
      },
      "6": {
        "attack": 26,
        "name": "Мифриловый меч"
      },
      "7": {
        "attack": 33,
        "name": "Адамантитовый меч"
      },
      "8": {
        "attack": 42,
        "name": "Меч бесконечности"
      }
    },
    "armor": {
      "1": {
        "defense": 3,
        "name": "Кожаная броня"
      },
      "2": {
        "defense": 6,
        "name": "Железная броня"
      },
      "3": {
        "defense": 10,
        "name": "Эльфийская броня"
      },
      "4": {
        "defense": 15,
        "name": "Обсидиановая броня"
      },
      "5": {
        "defense": 22,
        "name": "Гномья броня"
      },
      "6": {
        "defense": 30,
        "name": "Мифриловая броня"
      },
      "7": {
        "defense": 40,
        "name": "Адамантитовая броня"
      },
      "8": {
        "defense": 50,
        "name": "Драконья броня"
      }
    },
    "potion": {
      "1": {
        "healing": 37,
        "name": "Малое зелье"
      },
      "2": {
        "healing": "75",
        "name": "Среднее зелье"
      },
      "3": {
        "healing": "150",
        "name": "Большое зелье"
      },
      "4": {
        "healing": "300",
        "name": "Могучее зелье"
      },
      "5": {
        "healing": "600",
        "name": "Превосходное зелье"
      },
      "6": {
        "healing": "1200",
        "name": "Мастерское зелье"
      },
      "7": {
        "healing": "2400",
        "name": "Легендарное зелье"
      },
      "8": {
        "healing": "4800",
        "name": "Эликсир жизни"
      }
    },
    "magic": {
      "1": {
        "magic": 6,
        "name": "Деревянная палочка"
      },
      "2": {
        "magic": 10,
        "name": "Кристалльная палочка"
      },
      "3": {
        "magic": 14,
        "name": "Зачарованная палочка"
      },
      "4": {
        "magic": 19,
        "name": "Тайная палочка"
      },
      "5": {
        "magic": 25,
        "name": "Запрещённая палочка"
      },
      "6": {
        "magic": 32,
        "name": "Космическая палочка"
      },
      "7": {
        "magic": 40,
        "name": "Палочка всезнания"
      },
      "8": {
        "magic": 50,
        "name": "Палочка Акаши"
      }
    }
  },
  "level": "1",
  "lastStance": "balanced",
  "baseAttack": "1",
  "baseMagic": "1",
  "baseDefense": "1"
};
