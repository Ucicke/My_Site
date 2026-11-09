/* Editable item balance values and static item shape/icon definitions. */
// Centralized item stats data structure
      window.itemStats = {
        // Weapons - Attack Power
        dagger: {
          1: { attack: 5, name: 'Ржавый меч' },
          2: { attack: 8, name: 'Железный меч' },
          3: { attack: 11, name: 'Эльфийский меч' },
          4: { attack: 15, name: 'Обсидиановый меч' },
          5: { attack: 20, name: 'Гномий меч' },
          6: { attack: 26, name: 'Мифриловый меч' },
          7: { attack: 33, name: 'Адамантитовый меч' },
          8: { attack: 42, name: 'Меч бесконечности' },
        },
        // Armor - Defense Power (all full armor types)
        armor: {
          1: { defense: 3, name: 'Кожаная броня' },
          2: { defense: 6, name: 'Железная броня' },
          3: { defense: 10, name: 'Эльфийская броня' },
          4: { defense: 15, name: 'Обсидиановая броня' },
          5: { defense: 22, name: 'Гномья броня' },
          6: { defense: 30, name: 'Мифриловая броня' },
          7: { defense: 40, name: 'Адамантитовая броня' },
          8: { defense: 50, name: 'Драконья броня' },
        },
        // Potions - Healing Amount (custom progression)
        potion: {
          1: { healing: 37, name: 'Малое зелье' },
          2: { healing: 75, name: 'Среднее зелье' },
          3: { healing: 150, name: 'Большое зелье' },
          4: { healing: 300, name: 'Могучее зелье' },
          5: { healing: 600, name: 'Превосходное зелье' },
          6: { healing: 1200, name: 'Мастерское зелье' },
          7: { healing: 2400, name: 'Легендарное зелье' },
          8: { healing: 4800, name: 'Эликсир жизни' },
        },
        // Magic - Magic Damage
        magic: {
          1: { magic: 6, name: 'Деревянная палочка' },
          2: { magic: 10, name: 'Кристалльная палочка' },
          3: { magic: 14, name: 'Зачарованная палочка' },
          4: { magic: 19, name: 'Тайная палочка' },
          5: { magic: 25, name: 'Запрещённая палочка' },
          6: { magic: 32, name: 'Космическая палочка' },
          7: { magic: 40, name: 'Палочка всезнания' },
          8: { magic: 50, name: 'Палочка Акаши' },
        },
      };

      // Item type definitions - size and visual properties only
      window.itemTypes = {
        // Weapons (Red) - All 1x2 size
        dagger: {
          name: 'Оружие',
          category: 'weapon',
          width: 1,
          height: 2,
          icons: [
            'rusty_sword_dark_new',
            'iron_sword_diagonal',
            'elven_sword_diagonal',
            'obsidian_sword_diagonal',
            'dwarven_sword_diagonal',
            'mithril_sword_diagonal',
            'adamantite_sword_diagonal',
            'infinity_blade_diagonal',
          ],
        },

        // Armor (Blue) - All 2x2 size
        armor: {
          name: 'Броня',
          category: 'armor',
          width: 2,
          height: 2,
          icons: [
            'leather_armor_dark_new',
            'iron_armor_dark',
            'elven_armor_dark',
            'obsidian_armor_dark',
            'dwarven_armor_dark',
            'mithril_armor_dark',
            'adamantite_armor_dark',
            'dragon_armor_dark',
          ],
        },

        // Potions (Red) - All 1x1 size
        potion: {
          name: 'Зелье',
          category: 'potion',
          width: 1,
          height: 1,
          icons: [
            'red_potion_dark_tier1',
            'red_potion_dark_tier2',
            'red_potion_dark_tier3',
            'red_potion_dark_tier4',
            'red_potion_dark_tier5',
            'red_potion_dark_tier6',
            'red_potion_dark_tier7',
            'red_potion_dark_tier8',
          ],
        },

        // Magic (Purple) - All 1x2 size (vertical wands)
        magic: {
          name: 'Магия',
          category: 'magic',
          width: 1,
          height: 2,
          icons: [
            'magic_wand_dark_tier1',
            'magic_wand_dark_tier2',
            'magic_wand_dark_tier3',
            'magic_wand_dark_tier4',
            'magic_wand_dark_tier5',
            'magic_wand_dark_tier6',
            'magic_wand_dark_tier7',
            'magic_wand_dark_tier8',
          ],
        },
      };

// Maximum tier for each item type (8 tiers: 1-8)
      window.itemMaxTiers = {
        dagger: 8,
        armor: 8,
        potion: 8,
        magic: 8,
      };
