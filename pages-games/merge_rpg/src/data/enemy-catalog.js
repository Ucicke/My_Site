/* Static enemy definitions and base combat values. */
// Enemy definitions - 8 different monster types with increasing difficulty
      // Each enemy now has separate physical defense (physDef) and magic defense (magicDef)
      // Updated with new dark fantasy sprites for more brutal, terrifying appearance
      window.enemyCatalog = {
        weak: {
          name: 'Скелет-воин',
          hp: 30,
          attack: 6,
          physDef: 2,
          magicDef: 1,
          asset: 'skeleton_warrior_dark',
        }, // First skeleton weakened back to original values
        medium: {
          name: 'Орк-воин',
          hp: 200,
          attack: 36,
          physDef: 16,
          magicDef: 8,
          asset: 'orc_warrior_left_facing',
        }, // Second skeleton strengthened 2x (100→200, 18→36, 8→16, 4→8)
        strong: {
          name: 'Дракон',
          hp: 180,
          attack: 30,
          physDef: 15,
          magicDef: 10,
          asset: 'dragon_dark',
        },
        troll: {
          name: 'Пещерный тролль',
          hp: 280,
          attack: 42,
          physDef: 22,
          magicDef: 12,
          asset: 'cave_troll_dark',
        },
        lich: {
          name: 'Лич-колдун',
          hp: 380,
          attack: 55,
          physDef: 12,
          magicDef: 30,
          asset: 'lich_sorcerer_left_facing',
        },
        demon: {
          name: 'Адский демон',
          hp: 500,
          attack: 72,
          physDef: 25,
          magicDef: 22,
          asset: 'infernal_demon_dark',
        },
        ancient_dragon: {
          name: 'Древний дракон',
          hp: 650,
          attack: 95,
          physDef: 35,
          magicDef: 30,
          asset: 'ancient_dragon_dark',
        },
        void_lord: {
          name: 'Повелитель Пустоты',
          hp: 600,
          attack: 85,
          physDef: 28,
          magicDef: 28,
          asset: 'void_lord_dark',
        },
      };
