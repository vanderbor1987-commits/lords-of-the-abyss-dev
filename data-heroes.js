/* ==========================================================
   LORDS OF THE ABYSS — БАЗА ДАННЫХ ГЕРОЕВ (data-heroes.js)
   84 героя • Баланс 4 стихий по 21 герою • Синергии и Стихии
   ========================================================== */

const HEROES_CATALOG = {
    // ==========================================
    // РАНГ [F] (БАЗОВЫЙ ПРИЗЫВ)
    // ==========================================
    'f_und_v': { 
        id: 'f_und_v', tier: 'F', faction: 'undead', role: 'Авангард', cp: 42, cap: 30, icon: '💀', 
        name: { RU: 'Ополченец Склепа', EN: 'Crypt Militia' }, 
        lore: { 
            RU: 'В его контракте на городскую стражу не было пункта о смерти. Когда плоть истлела, капитан просто выдал щит покрепче.', 
            EN: 'His guard contract lacked an expiration clause for dying. When his flesh rotted away, the captain simply handed him a sturdier shield.' 
        } 
    },
    'f_und_c': { 
        id: 'f_und_c', tier: 'F', faction: 'undead', role: 'Главком', cp: 48, cap: 35, icon: '📜', 
        name: { RU: 'Смотритель Могил', EN: 'Grave Warden' }, 
        lore: { 
            RU: 'Он не воскрешает мертвых — он лишь напоминает им о невыплаченных долгах перед казной Цитадели.', 
            EN: 'He does not raise the dead—he merely reminds them of their outstanding debts to the Citadel treasury.' 
        } 
    },
    'f_und_r': { 
        id: 'f_und_r', tier: 'F', faction: 'undead', role: 'Тыл', cp: 38, cap: 25, icon: '🕯️', 
        name: { RU: 'Пепельный Слуга', EN: 'Ash Servant' }, 
        lore: { 
            RU: 'Шепчет забытые имена в замочные скважины. Тот, кто отзовется в темноте, наутро не находит своего отражения.', 
            EN: 'Whispers forgotten names through keyholes. Whoever answers in the dark finds no reflection in the morning.' 
        } 
    },

    'f_dem_v': { 
        id: 'f_dem_v', tier: 'F', faction: 'demon', role: 'Авангард', cp: 44, cap: 30, icon: '👺', 
        name: { RU: 'Бес Пропасти', EN: 'Chasm Imp' }, 
        lore: { 
            RU: 'Слишком мелкий, чтобы внушать страх, и слишком злобный, чтобы повернуться к нему спиной.', 
            EN: 'Too puny to inspire terror, yet far too malicious to ever turn your back on.' 
        } 
    },
    'f_dem_c': { 
        id: 'f_dem_c', tier: 'F', faction: 'demon', role: 'Главком', cp: 48, cap: 35, icon: '🔥', 
        name: { RU: 'Гончий Загонщик', EN: 'Hound Driver' }, 
        lore: { 
            RU: 'Его плетка сплетена из жил тех адских псов, что посмели заскулить перед пастью Бездны.', 
            EN: 'His whip is braided from the sinews of hounds that dared to whimper before the maw of the Abyss.' 
        } 
    },
    'f_dem_r': { 
        id: 'f_dem_r', tier: 'F', faction: 'demon', role: 'Тыл', cp: 40, cap: 25, icon: '🧨', 
        name: { RU: 'Поджигатель Серы', EN: 'Brimstone Tosser' }, 
        lore: { 
            RU: 'Искренне верит, что любая вещь в мире становится красивее, если полить её горящей смолой.', 
            EN: 'Genuinely believes that anything in this world is improved by dousing it in boiling pitch.' 
        } 
    },

    'f_lig_v': { 
        id: 'f_lig_v', tier: 'F', faction: 'light', role: 'Авангард', cp: 42, cap: 30, icon: '🛡️', 
        name: { RU: 'Стражник Ворот', EN: 'Gate Sentry' }, 
        lore: { 
            RU: '«Стой и не задавай вопросов. Если тебя ослепит свет из бойниц — значит, ты заслужил наказание.»', 
            EN: '"Halt and ask no questions. If the light from the battlements blinds you, you deserved the punishment."' 
        } 
    },
    'f_lig_c': { 
        id: 'f_lig_c', tier: 'F', faction: 'light', role: 'Главком', cp: 47, cap: 35, icon: '🎺', 
        name: { RU: 'Трубач Дозора', EN: 'Watch Herald' }, 
        lore: { 
            RU: 'Медный горн звенит так пронзительно, что глушит предсмертные вопли раненых, оставляя место только маршу.', 
            EN: 'The horn blares so sharply that it drowns out death-cries of the wounded, leaving room only for the march.' 
        } 
    },
    'f_lig_r': { 
        id: 'f_lig_r', tier: 'F', faction: 'light', role: 'Тыл', cp: 39, cap: 25, icon: '🏹', 
        name: { RU: 'Городской Лучник', EN: 'Town Archer' }, 
        lore: { 
            RU: '«Не молись о промахе. Молись умереть сразу — серебряное масло в ране горит неделями.»', 
            EN: '"Do not pray for a miss. Pray to die instantly—the consecrated oil burns inside the wound for weeks."' 
        } 
    },

    'f_cha_v': { 
        id: 'f_cha_v', tier: 'F', faction: 'chaos', role: 'Авангард', cp: 45, cap: 32, icon: '🪓', 
        name: { RU: 'Трущобный Грабитель', EN: 'Slum Plunderer' }, 
        lore: { 
            RU: 'Ржавый колун бесполезен против лат, но великолепен для тех, кто упал лицом в грязь под ноги толпе.', 
            EN: 'A rusted cleaver is useless against plate, but magnificent against anyone who falls face-first into the mud.' 
        } 
    },
    'f_cha_c': { 
        id: 'f_cha_c', tier: 'F', faction: 'chaos', role: 'Главком', cp: 48, cap: 35, icon: '🗡️', 
        name: { RU: 'Бродяга Трущоб', EN: 'Slum Drifter' }, 
        lore: { 
            RU: 'Закон прост: если у тебя есть нож — ты прав; если два ножа — ты верховный судья квартала.', 
            EN: 'The law is simple: hold a knife and you are right; hold two knives and you are the district magistrate.' 
        } 
    },
    'f_cha_r': { 
        id: 'f_cha_r', tier: 'F', faction: 'chaos', role: 'Тыл', cp: 40, cap: 25, icon: '🎯', 
        name: { RU: 'Метатель Кинжалов', EN: 'Dagger Flinger' }, 
        lore: { 
            RU: 'Лезвия смазаны болотной слизью. Смерть наступает не от железа, а от гниения заживо.', 
            EN: 'The blades are coated in bog slime. Death comes not from the iron, but from rotting alive.' 
        } 
    },

    // ==========================================
    // РАНГ [E]
    // ==========================================
    'e_und_v': { 
        id: 'e_und_v', tier: 'E', faction: 'undead', role: 'Авангард', cp: 95, cap: 75, icon: '⛓️', 
        name: { RU: 'Железный Рекрут', EN: 'Iron Recruit' }, 
        lore: { 
            RU: 'Латы заклепали прямо на костях. Снять этот доспех нельзя — можно только раздробить его вместе со скелетом.', 
            EN: 'The plate was riveted straight to the bone. You cannot strip his armor—only shatter it with his frame.' 
        } 
    },
    'e_und_c': { 
        id: 'e_und_c', tier: 'E', faction: 'undead', role: 'Главком', cp: 105, cap: 80, icon: '🪦', 
        name: { RU: 'Офицер Костяниц', EN: 'Ossuary Officer' }, 
        lore: { 
            RU: 'Шаг его шеренги звучит как треск сухих веток в мертвом лесу. Ни вздоха, ни сомнения, ни жалости.', 
            EN: 'His line marches with the snap of dry branches in a dead wood. No breath, no hesitation, no mercy.' 
        } 
    },
    'e_und_r': { 
        id: 'e_und_r', tier: 'E', faction: 'undead', role: 'Тыл', cp: 90, cap: 70, icon: '🧪', 
        name: { RU: 'Чумной Алхимик', EN: 'Plague Brewer' }, 
        lore: { 
            RU: '«Идеальный солдат не ест, не спит и пахнет полынью. С первыми двумя пунктами мы уже закончили.»', 
            EN: '"The perfect soldier never eats, never sleeps, and smells of wormwood. We have sorted out the first two."' 
        } 
    },

    'e_dem_v': { 
        id: 'e_dem_v', tier: 'E', faction: 'demon', role: 'Авангард', cp: 100, cap: 75, icon: '🩸', 
        name: { RU: 'Монах Крови', EN: 'Blood Monk' }, 
        lore: { 
            RU: 'Каждый порез на его теле — это молитва. Когда он истекает кровью, его боевой рев становится только громче.', 
            EN: 'Every gash across his skin is scripture. As his blood pours, his war-chants only grow louder.' 
        } 
    },
    'e_dem_c': { 
        id: 'e_dem_c', tier: 'E', faction: 'demon', role: 'Главком', cp: 108, cap: 85, icon: '🪖', 
        name: { RU: 'Адский Сержант', EN: 'Infernal Corporal' }, 
        lore: { 
            RU: 'Огненный кнут выбивает искры из каменного пола. Демоны боятся его окрика больше, чем вражеских клинков.', 
            EN: 'His blazing whip draws sparks from the stone. Lesser fiends dread his shout far more than hostile steel.' 
        } 
    },
    'e_dem_r': { 
        id: 'e_dem_r', tier: 'E', faction: 'demon', role: 'Тыл', cp: 92, cap: 70, icon: '🔥', 
        name: { RU: 'Чародей Пламени', EN: 'Flame Sorcerer' }, 
        lore: { 
            RU: 'Пепел под его ногами шепчет проклятия. Он не гасит костры — он дает им сожрать саму землю под ногами.', 
            EN: 'Ashes whisper curses beneath his boots. He never quenches fire—he lets it devour the very earth.' 
        } 
    },

    'e_lig_v': { 
        id: 'e_lig_v', tier: 'E', faction: 'light', role: 'Авангард', cp: 96, cap: 75, icon: '⚔️', 
        name: { RU: 'Меченосец Рассвета', EN: 'Dawn Swordsman' }, 
        lore: { 
            RU: 'Двуручник закален в расплавленном воске соборных свечей. Его удар оставляет ожоги даже на бесплотных призраках.', 
            EN: 'His greatsword was quenched in molten tallow from cathedral tapers. Its cleave leaves burns on phantoms.' 
        } 
    },
    'e_lig_c': { 
        id: 'e_lig_c', tier: 'E', faction: 'light', role: 'Главком', cp: 104, cap: 80, icon: '🦅', 
        name: { RU: 'Сотник Серебряных', EN: 'Silver Centurion' }, 
        lore: { 
            RU: 'Дисциплина — это щит, держащий свод мира. Тот, кто отступит на шаг, будет предан анафеме до седьмого колена.', 
            EN: 'Discipline is the wall upholding the firmament. Whoever retreats a single pace is damned for seven lives.' 
        } 
    },
    'e_lig_r': { 
        id: 'e_lig_r', tier: 'E', faction: 'light', role: 'Тыл', cp: 90, cap: 70, icon: '🏹', 
        name: { RU: 'Стражница Пустошей', EN: 'Wasteland Scout' }, 
        lore: { 
            RU: 'Ее стрелы летят против ветра, ведомые фанатичным шепотом полуденного слепящего солнца.', 
            EN: 'Her arrows sail against howling gales, guided by the zealot whisper of the midday sun.' 
        } 
    },

    'e_cha_v': { 
        id: 'e_cha_v', tier: 'E', faction: 'chaos', role: 'Авангард', cp: 102, cap: 75, icon: '🐗', 
        name: { RU: 'Дикарь Вереска', EN: 'Bramble Brute' }, 
        lore: { 
            RU: 'Он не помнит своего кланового имени, но отлично помнит вкус железа и тепло чужого распоротого нутра.', 
            EN: 'He recalls neither clan nor mother, only the coppery taste of iron and the warmth of entrails.' 
        } 
    },
    'e_cha_c': { 
        id: 'e_cha_c', tier: 'E', faction: 'chaos', role: 'Главком', cp: 108, cap: 85, icon: '🐺', 
        name: { RU: 'Вожак Стаи', EN: 'Pack Alpha' }, 
        lore: { 
            RU: 'Его боевой вой поднимает хищников из оврагов. Стая не знает слова «отступление» — в ее словаре есть только «добыча».', 
            EN: 'His howl summons predators from ravines. The pack knows no retreat—only the chase and the kill.' 
        } 
    },
    'e_cha_r': { 
        id: 'e_cha_r', tier: 'E', faction: 'chaos', role: 'Тыл', cp: 94, cap: 70, icon: '🪶', 
        name: { RU: 'Шаман Пустошей', EN: 'Barren Shaman' }, 
        lore: { 
            RU: 'Пыль, которую он швыряет во врагов, — это истертые в песок кости древних царей, не удержавших свои империи.', 
            EN: 'The dust he flings into eyes is the pulverized bone of forgotten monarchs who lost their realms.' 
        } 
    },

    // ==========================================
    // РАНГ [D]
    // ==========================================
    'd_und_v': { 
        id: 'd_und_v', tier: 'D', faction: 'undead', role: 'Авангард', cp: 215, cap: 170, icon: '🛡️', 
        name: { RU: 'Гробовой Рыцарь', EN: 'Sepulcher Knight' }, 
        lore: { 
            RU: 'Он заковал себя в броню при жизни и проглотил ключ от замка, залив его расплавленным свинцом. Только падение Цитадели освободит его от клятвы.', 
            EN: 'He sealed himself in plate while living and swallowed the key coated in molten lead. Only the fall of the Citadel breaks his oath.' 
        } 
    },
    'd_und_c': { 
        id: 'd_und_c', tier: 'D', faction: 'undead', role: 'Главком', cp: 235, cap: 180, icon: '👑', 
        name: { RU: 'Лорд Некрополя', EN: 'Necropolis Lord' }, 
        lore: { 
            RU: 'В его склепе безупречный порядок: черепа сложены по чинам, а клятвы вечного служения высечены на граните надгробий.', 
            EN: 'His crypt is orderly: skulls stacked by military rank, and oaths of eternal service carved into the tombstone.' 
        } 
    },
    'd_und_r': { 
        id: 'd_und_r', tier: 'D', faction: 'undead', role: 'Тыл', cp: 205, cap: 155, icon: '🧪', 
        name: { RU: 'Ученица Зельевара', EN: 'Potion Apprentice' }, 
        lore: { 
            RU: '«Осторожнее со склянкой. Если хоть капля упадет на сапог — к утру от тебя останется только каблук.»', 
            EN: '"Careful with the flask. If a single drop hits your leather boot, by dawn only the heel remains."' 
        } 
    },

    'd_dem_v': { 
        id: 'd_dem_v', tier: 'D', faction: 'demon', role: 'Авангард', cp: 225, cap: 175, icon: '👹', 
        name: { RU: 'Рогатый Громила', EN: 'Horned Enforcer' }, 
        lore: { 
            RU: 'Его рога обуглены небесными молниями. Он врезается в башенные щиты с таким грохотом, будто ломает сухой плетень.', 
            EN: 'His horns are blackened by divine thunderbolts. He impacts heavy tower shields like brittle wicker.' 
        } 
    },
    'd_dem_c': { 
        id: 'd_dem_c', tier: 'D', faction: 'demon', role: 'Главком', cp: 240, cap: 180, icon: '🔱', 
        name: { RU: 'Легат Пекла', EN: 'Abyssal Legate' }, 
        lore: { 
            RU: 'Война для него — расчет кипящей смолы. Никакой рыцарской чести, только беспощадная геометрия тотального сожжения.', 
            EN: 'War to him is calculus of boiling pitch. No chivalric honor, only the geometry of absolute immolation.' 
        } 
    },
    'd_dem_r': { 
        id: 'd_dem_r', tier: 'D', faction: 'demon', role: 'Тыл', cp: 210, cap: 160, icon: '🌋', 
        name: { RU: 'Призыватель Лавы', EN: 'Lava Conjurer' }, 
        lore: { 
            RU: 'Земля трескается там, куда указывает его посох. Камни вскипают, словно вода в котле грешника.', 
            EN: 'The earth splits where his staff points. Solid bedrock boils like brine in a sinner kettle.' 
        } 
    },

    'd_lig_v': { 
        id: 'd_lig_v', tier: 'D', faction: 'light', role: 'Авангард', cp: 218, cap: 175, icon: '🏰', 
        name: { RU: 'Щитоносец Бастиона', EN: 'Bastion Warden' }, 
        lore: { 
            RU: 'Его башенный щит весит больше взрослого быка. За ним не развернуться для маневра, но за ним можно пережить падение неба.', 
            EN: 'His pavise outweighs an ox. There is no room to maneuver behind it, but you can survive the fall of stars.' 
        } 
    },
    'd_lig_c': { 
        id: 'd_lig_c', tier: 'D', faction: 'light', role: 'Главком', cp: 232, cap: 180, icon: '⚖️', 
        name: { RU: 'Инквизитор Пепла', EN: 'Ash Inquisitor' }, 
        lore: { 
            RU: 'Священное пламя не различает праведников и еретиков. Оно лишь проверяет, кто из них сгорит быстрее.', 
            EN: 'Sacred fire distinguishes neither saints nor heretics. It merely measures who burns to ash quicker.' 
        } 
    },
    'd_lig_r': { 
        id: 'd_lig_r', tier: 'D', faction: 'light', role: 'Тыл', cp: 208, cap: 155, icon: '✨', 
        name: { RU: 'Клирик Крепости', EN: 'Fortress Cleric' }, 
        lore: { 
            RU: 'Его молитвы оставляют ожоги на ладонях союзников. Божественная благодать в Бездне ранит почти так же, как клинки.', 
            EN: 'His benedictions blister allied palms. Divine grace inside the Abyss stings almost as raw as cold iron.' 
        } 
    },

    'd_cha_v': { 
        id: 'd_cha_v', tier: 'D', faction: 'chaos', role: 'Авангард', cp: 228, cap: 175, icon: '⚔️', 
        name: { RU: 'Головорез Бездны', EN: 'Abyss Cutthroat' }, 
        lore: { 
            RU: 'Два зазубренных клинка двигаются быстрее взгляда. Он подрезает сухожилия раньше, чем враг успевает понять, что бой начался.', 
            EN: 'Twin serrated blades slice faster than thought. He sunders tendons before foes realize the clash has begun.' 
        } 
    },
    'd_cha_c': { 
        id: 'd_cha_c', tier: 'D', faction: 'chaos', role: 'Главком', cp: 238, cap: 180, icon: '🏴‍☠️', 
        name: { RU: 'Капитан Наемников', EN: 'Mercenary Captain' }, 
        lore: { 
            RU: '«Золото на стол. За двойную плату я перебью нанимателя, за тройную — сделаю это с безупречной улыбкой.»', 
            EN: '"Coin upfront. For double, I slay your commissioner; for triple, I do so with an impeccably polite grin."' 
        } 
    },
    'd_cha_r': { 
        id: 'd_cha_r', tier: 'D', faction: 'chaos', role: 'Тыл', cp: 212, cap: 160, icon: '🎯', 
        name: { RU: 'Арбалетчик Бури', EN: 'Storm Crossbowman' }, 
        lore: { 
            RU: 'Тяжелый стальной ворот натягивает тросы. Болт пробивает дубовые створы ворот вместе со спинами защитников.', 
            EN: 'The windlass spans tempered iron. The quarrel punches through solid oak gates and the sentries behind.' 
        } 
    },

    // ==========================================
    // РАНГ [C]
    // ==========================================
    'c_und_v': { 
        id: 'c_und_v', tier: 'C', faction: 'undead', role: 'Авангард', cp: 460, cap: 350, icon: '🌑', 
        name: { RU: 'Рыцарь Затмения', EN: 'Eclipse Knight' }, 
        lore: { 
            RU: 'Клинок выкован из звездного метеорита, пробившего гробницу. Меч не отражает пламя — он жадно впитывает свет вокруг себя.', 
            EN: 'Forged from meteorite iron that pierced an ancestral crypt. The blade reflects no fire—it drinks all light.' 
        } 
    },
    'c_und_c': { 
        id: 'c_und_c', tier: 'C', faction: 'undead', role: 'Главком', cp: 490, cap: 380, icon: '👑', 
        name: { RU: 'Генерал Смерти', EN: 'General of Dread' }, 
        lore: { 
            RU: 'Он выигрывает осады, не обнажая меча. Мертвецы наступают с неотвратимостью ледника, перемалывая в пыль укрепления.', 
            EN: 'He wins campaigns without drawing steel. The dead advance with glacial certainty, grinding fortresses to powder.' 
        } 
    },
    'c_und_r': { 
        id: 'c_und_r', tier: 'C', faction: 'undead', role: 'Тыл', cp: 440, cap: 330, icon: '🔮', 
        name: { RU: 'Некромант Бездны', EN: 'Abyssal Necromancer' }, 
        lore: { 
            RU: '«Зачем оплакивать павших соратников, если ровно через шестьдесят ударов сердца они снова способны держать копье?»', 
            EN: '"Why mourn fallen comrades when within sixty heartbeats they can shoulder their pikes once more?"' 
        } 
    },

    'c_dem_v': { 
        id: 'c_dem_v', tier: 'C', faction: 'demon', role: 'Авангард', cp: 475, cap: 360, icon: '👺', 
        name: { RU: 'Палач Преисподней', EN: 'Underworld Executioner' }, 
        lore: { 
            RU: 'Его топор не точат — зазубрины и запекшаяся смола причиняют куда более изысканную боль тем, кто дрогнул в строю.', 
            EN: 'His execution axe is never polished—crude notches and burnt tar torture cowards far more exquisitely.' 
        } 
    },
    'c_dem_c': { 
        id: 'c_dem_c', tier: 'C', faction: 'demon', role: 'Главком', cp: 505, cap: 390, icon: '🔱', 
        name: { RU: 'Барон Серных Врат', EN: 'Baron of Brimstone' }, 
        lore: { 
            RU: 'Запах серы предшествует его когортам за три версты. Под его знаменами сама почва начинает сочиться горькой лавой.', 
            EN: 'The stench of brimstone precedes his legions by leagues. Beneath his banner, the loam weeps bitter magma.' 
        } 
    },
    'c_dem_r': { 
        id: 'c_dem_r', tier: 'C', faction: 'demon', role: 'Тыл', cp: 450, cap: 340, icon: '🩸', 
        name: { RU: 'Маг Кровавого Тумана', EN: 'Crimson Fog Witch' }, 
        lore: { 
            RU: 'Багровый морок просачивается сквозь закрытые забрала, сворачивая кровь в легких стрелков еще до первого выстрела.', 
            EN: 'Crimson mist seeps through sealed visors, clotting blood in archer throats before the first volley flies.' 
        } 
    },

    'c_lig_v': { 
        id: 'c_lig_v', tier: 'C', faction: 'light', role: 'Авангард', cp: 465, cap: 355, icon: '☀️', 
        name: { RU: 'Рыцарь Собора', EN: 'Cathedral Knight' }, 
        lore: { 
            RU: 'Белая эмаль на его броне не чернеет от копоти. Он идет в штурм как живой алтарь веры, не ведающей компромиссов.', 
            EN: 'The ivory lacquer on his breastplate never soils. He marches as a living shrine to uncompromising dogma.' 
        } 
    },
    'c_lig_c': { 
        id: 'c_lig_c', tier: 'C', faction: 'light', role: 'Главком', cp: 495, cap: 380, icon: '⚜️', 
        name: { RU: 'Капитан Крылатых', EN: 'Winged Captain' }, 
        lore: { 
            RU: 'Тень его крыльев на поле брани пугает врагов сильнее стрел. С высоты полета он видит каждую дрогнувшую шеренгу.', 
            EN: 'The shadow of his wings unnerves foes far more than quarrels. From aloft, he marks every wavering shield.' 
        } 
    },
    'c_lig_r': { 
        id: 'c_lig_r', tier: 'C', faction: 'light', role: 'Тыл', cp: 445, cap: 335, icon: '🌙', 
        name: { RU: 'Жрица Звезд', EN: 'Astral Priestess' }, 
        lore: { 
            RU: 'Метеоры с небес оставляют воронки из расплавленного стекла. Небосвод не плачет о грешниках — он методично выжигает их.', 
            EN: 'Meteors leave glassed impact craters. The firmament weeps no tears for sinners—it obliterates them.' 
        } 
    },

    'c_cha_v': { 
        id: 'c_cha_v', tier: 'C', faction: 'chaos', role: 'Авангард', cp: 470, cap: 360, icon: '🪓', 
        name: { RU: 'Берсерк Клана', EN: 'Clan Berserker' }, 
        lore: { 
            RU: 'Стрелы торчат из его груди, словно сухие ветки, но он смеется хриплым смехом и продолжает рубить топорами наотмашь.', 
            EN: 'Arrows bristle in his chest like thorns, yet he roars with jagged laughter and hacks through shields.' 
        } 
    },
    'c_cha_c': { 
        id: 'c_cha_c', tier: 'C', faction: 'chaos', role: 'Главком', cp: 500, cap: 390, icon: '🗡️', 
        name: { RU: 'Герцог Мятежников', EN: 'Rebel Duke' }, 
        lore: { 
            RU: 'Сорвал родовые гербы предков со своего знамени. Единственный закон, который он чтит, — священное право железа забрать всё.', 
            EN: 'He stripped ancestral seals from his colors. The sole decree he obeys is the sacred claim of steel.' 
        } 
    },
    'c_cha_r': { 
        id: 'c_cha_r', tier: 'C', faction: 'chaos', role: 'Тыл', cp: 440, cap: 330, icon: '🪶', 
        name: { RU: 'Ведьма Топей', EN: 'Swamp Witch' }, 
        lore: { 
            RU: 'Зловонная жижа из ее чана растворяет латы быстрее кислоты. Доспех превращается в жижу вместе с тем, кто его носил.', 
            EN: 'The foul mire from her pot melts plate swifter than acid. Armor liquefies alongside the flesh inside.' 
        } 
    },

    // ==========================================
    // РАНГ [B]
    // ==========================================
    'b_und_v': { 
        id: 'b_und_v', tier: 'B', faction: 'undead', role: 'Авангард', cp: 980, cap: 730, icon: '🗿', 
        name: { RU: 'Страж Рунного Вала', EN: 'Runic Bulwark' }, 
        lore: { 
            RU: 'Монолит высечен из фундамента первой разрушенной Цитадели. Руны на черном граните пульсируют могильным холодом пустоты.', 
            EN: 'Monolith hewn from the bedrock of the primeval ruined Citadel. Runes pulse with the tomb-cold of the void.' 
        } 
    },
    'b_und_c': { 
        id: 'b_und_c', tier: 'B', faction: 'undead', role: 'Главком', cp: 1040, cap: 760, icon: '👑', 
        name: { RU: 'Король Костей', EN: 'King of Ossuaries' }, 
        lore: { 
            RU: 'Корона намертво срослась с черепом века назад. Его приказы звучат в костях павших солдат помимо их собственной воли.', 
            EN: 'His diadem fused with skull-bone centuries ago. His orders echo in dead marrow, defying all resistance.' 
        } 
    },
    'b_und_r': { 
        id: 'b_und_r', tier: 'B', faction: 'undead', role: 'Тыл', cp: 940, cap: 700, icon: '🔮', 
        name: { RU: 'Алхимик Малвис', EN: 'Alchemist Malvis' }, 
        lore: { 
            RU: 'Он дистиллирует души клятвопреступников в черную эссенцию. Капля этого яда разъедает саму судьбу и память о жертве.', 
            EN: 'He distills traitor souls into umbral essence. A drop of this elixir corrodes the destiny of its victim.' 
        } 
    },

    'b_dem_v': { 
        id: 'b_dem_v', tier: 'B', faction: 'demon', role: 'Авангард', cp: 1010, cap: 740, icon: '🌋', 
        name: { RU: 'Огненный Голем', EN: 'Magma Golem' }, 
        lore: { 
            RU: 'Сердце голема — остывающее ядро упавшей кометы. Каждый его шаг вдавливает в землю колею из расплавленного базальта.', 
            EN: 'His core is the cooling heart of a fallen comet. Each stomp stamps a ditch of bubbling basalt into earth.' 
        } 
    },
    'b_dem_c': { 
        id: 'b_dem_c', tier: 'B', faction: 'demon', role: 'Главком', cp: 1060, cap: 770, icon: '🐺', 
        name: { RU: 'Капитан Черных Псов', EN: 'Houndmaster' }, 
        lore: { 
            RU: 'Адские псы чуют запах страха за лигу. Когда он спускает поводья цепей, о пощаде забывают даже коронованные лорды.', 
            EN: 'Nether-hounds smell terror leagues away. When he drops their iron leads, even anointed kings forget mercy.' 
        } 
    },
    'b_dem_r': { 
        id: 'b_dem_r', tier: 'B', faction: 'demon', role: 'Тыл', cp: 960, cap: 710, icon: '👁️', 
        name: { RU: 'Оракул Скверны', EN: 'Defiler Oracle' }, 
        lore: { 
            RU: 'Пустые глазницы видят не грядущие эпохи, а сотни мучительных смертей каждого, кто осмелился посмотреть в ее сторону.', 
            EN: 'Her blind sockets perceive not coming eras, but hundredfold agony awaiting whoever dares look upon her.' 
        } 
    },

    'b_lig_v': { 
        id: 'b_lig_v', tier: 'B', faction: 'light', role: 'Авангард', cp: 990, cap: 735, icon: '🛡️', 
        name: { RU: 'Храмовник Света', EN: 'Radiant Templar' }, 
        lore: { 
            RU: 'Щит отражает полуденное солнце с такой яростью, что шеренга врагов слепнет и обугливается за секунды до столкновения.', 
            EN: 'His pavise mirrors midday sun with such fury that enemy vanguard lines char and blind before shields lock.' 
        } 
    },
    'b_lig_c': { 
        id: 'b_lig_c', tier: 'B', faction: 'light', role: 'Главком', cp: 1050, cap: 765, icon: '⚜️', 
        name: { RU: 'Верховный Прелат', EN: 'High Prelate' }, 
        lore: { 
            RU: 'Слова его молитвы падают с небес подобно ударам осадных орудий. Солдаты со слабой верой падают ниц с лопнувшими перепонками.', 
            EN: 'His prayers thunder like siege artillery. Those whose devotion wavers drop with ruptured eardrums.' 
        } 
    },
    'b_lig_r': { 
        id: 'b_lig_r', tier: 'B', faction: 'light', role: 'Тыл', cp: 950, cap: 705, icon: '✨', 
        name: { RU: 'Магистр Авроры', EN: 'Aurora Magister' }, 
        lore: { 
            RU: 'Северное сияние в его руках сгущается в смертоносные серпы света. Небесный огонь оставляет после себя лишь стерильный пепел.', 
            EN: 'The aurora shears into light-blades at his gesture. Heavenly radiance leaves behind only clean ash.' 
        } 
    },

    'b_cha_v': { 
        id: 'b_cha_v', tier: 'B', faction: 'chaos', role: 'Авангард', cp: 1000, cap: 745, icon: '🪓', 
        name: { RU: 'Дробитель Черепов', EN: 'Skull Breaker' }, 
        lore: { 
            RU: 'Шипастая булава весит полцентнера. Ее удар расплющивает башенный щит вместе с латами и надеждой выжить.', 
            EN: 'His spiked maul weighs half a hundredweight. Its crush flattens pavise, harness, and any prayer of survival.' 
        } 
    },
    'b_cha_c': { 
        id: 'b_cha_c', tier: 'B', faction: 'chaos', role: 'Главком', cp: 1050, cap: 765, icon: '🌪️', 
        name: { RU: 'Воевода Бури', EN: 'Warlord of Tempest' }, 
        lore: { 
            RU: 'Ведет орду верхом на вихрях Бездны. Натиск его клина разрывает укрепленные фланги быстрее весеннего селевого потока.', 
            EN: 'He leads warbands riding vortexes of the Abyss. The vanguard wedge tears fortified flanks like a torrent.' 
        } 
    },
    'b_cha_r': { 
        id: 'b_cha_r', tier: 'B', faction: 'chaos', role: 'Тыл', cp: 940, cap: 700, icon: '🏹', 
        name: { RU: 'Снайпер Затмения', EN: 'Eclipse Sniper' }, 
        lore: { 
            RU: 'Спуск ее тетивы неслышен в реве битвы. Вражеский полководец валится из седла с черным пером в глазнице до первой команды.', 
            EN: 'Her bowstring never murmurs in the din. The enemy warlord falls with a black fletching in his eye before commanding.' 
        } 
    },

    // ==========================================
    // РАНГ [A]
    // ==========================================
    'a_und_v': { 
        id: 'a_und_v', tier: 'A', faction: 'undead', role: 'Авангард', cp: 1980, cap: 1580, icon: '💀', 
        name: { RU: 'Дракон Костей', EN: 'Skeletal Wyrm' }, 
        lore: { 
            RU: 'Крылья из истлевшего погребального савана и ребер титанов. Ледяное дыхание дракона обращает в камень кровь целых легионов.', 
            EN: 'Wings of burial shrouds and titan bones. Its absolute frost calcifies the blood of entire charging hosts.' 
        } 
    },
    'a_und_c': { 
        id: 'a_und_c', tier: 'A', faction: 'undead', role: 'Главком', cp: 2080, cap: 1620, icon: '👑', 
        name: { RU: 'Архилич Мортис', EN: 'Archlich Mortis' }, 
        lore: { 
            RU: 'Он читал летописи о гибели этого мира, когда звезды были молоды. Смерть для него — не финал, а всего лишь точка с запятой.', 
            EN: 'He studied the annals of this realm demise when stars were young. Death to him is not a stop, but a semicolon.' 
        } 
    },
    'a_und_r': { 
        id: 'a_und_r', tier: 'A', faction: 'undead', role: 'Тыл', cp: 1920, cap: 1470, icon: '🕯️', 
        name: { RU: 'Призрак Воющей Башни', EN: 'Wailing Wraith' }, 
        lore: { 
            RU: 'Ее вопль раскалывает рассудок смертных. Опытные ветераны бросают сталь и выцарапывают собственные глаза в приступе ужаса.', 
            EN: 'Her shriek splinters reason. Battle-hardened veterans drop pikes and claw their own eyes in delirium.' 
        } 
    },

    'a_dem_v': { 
        id: 'a_dem_v', tier: 'A', faction: 'demon', role: 'Авангард', cp: 2020, cap: 1600, icon: '👹', 
        name: { RU: 'Демон Разлома', EN: 'Rift Fiend' }, 
        lore: { 
            RU: 'Первобытный огонь недр, скованный обсидиановыми цепями. Каждый удар его клинка распарывает почву до кипящей магмы.', 
            EN: 'Primeval core fire bound in obsidian chains. Each cleave splits the soil down to boiling planetary magma.' 
        } 
    },
    'a_dem_c': { 
        id: 'a_dem_c', tier: 'A', faction: 'demon', role: 'Главком', cp: 2120, cap: 1650, icon: '🔥', 
        name: { RU: 'Генерал Пекла Азазель', EN: 'Hell General Azazel' }, 
        lore: { 
            RU: 'Он не ведет переговоров. Его условия капитуляции — это выжженная пустыня, на которой тысячу лет не прорастет даже мох.', 
            EN: 'He does not parley. His terms of conquest are an expanse of glassed cinders where lichen cannot sprout for a millennium.' 
        } 
    },
    'a_dem_r': { 
        id: 'a_dem_r', tier: 'A', faction: 'demon', role: 'Тыл', cp: 1940, cap: 1480, icon: '🩸', 
        name: { RU: 'Кровавая Суккуба', EN: 'Crimson Succubus' }, 
        lore: { 
            RU: 'Один тихий шепот сквозь щель в доспехах — и благороднейший лорд поворачивает полки против своей же Цитадели в сладком бреду.', 
            EN: 'One midnight murmur through an armor seam—and the proudest duke turns his banners on his Citadel in delirium.' 
        } 
    },

    'a_lig_v': { 
        id: 'a_lig_v', tier: 'A', faction: 'light', role: 'Авангард', cp: 2000, cap: 1600, icon: '☀️', 
        name: { RU: 'Паладин Солнца', EN: 'Solar Paladin' }, 
        lore: { 
            RU: '«Свет не прощает сомнений. Если твоя рука дрогнет — клинок первого рассвета рассечет тебя так же легко, как и порождение тьмы.»', 
            EN: '"Light excuses no frailty. Falter once, and the blade of first dawn severs you as easily as any chasm horror."' 
        } 
    },
    'a_lig_c': { 
        id: 'a_lig_c', tier: 'A', faction: 'light', role: 'Главком', cp: 2060, cap: 1500, icon: '⚜️', 
        name: { RU: 'Командор Валькирия', EN: 'Valkyrie Commander' }, 
        lore: { 
            RU: 'Крылья из чистого белого пламени разгоняют морок Бездны. Она решает, чья смерть станет эпической песней, а чья — гнилью во рву.', 
            EN: 'Wings of incandescent white pyre divide the gloom. She selects whose demise ascends to saga, and whose rots in the ditch.' 
        } 
    },
    'a_lig_r': { 
        id: 'a_lig_r', tier: 'A', faction: 'light', role: 'Тыл', cp: 1910, cap: 1450, icon: '🌙', 
        name: { RU: 'Жрица Лунного Света', EN: 'Moonlit Priestess' }, 
        lore: { 
            RU: 'Купол из лунного серебра отражает разрушительные проклятия. За ее спиной легион чувствует себя в нерушимом соборе.', 
            EN: 'Her dome of moon-silver deflects cataclysmic hexes. Behind her bulwark, the ranks rest within an unassailable sanctuary.' 
        } 
    },

    'a_cha_v': { 
        id: 'a_cha_v', tier: 'A', faction: 'chaos', role: 'Авангард', cp: 2030, cap: 1610, icon: '🐉', 
        name: { RU: 'Первобытная Гидра', EN: 'Primordial Hydra' }, 
        lore: { 
            RU: 'Отрубленная пасть окропляет землю едким ядом, а на ее месте вырастают две новые. Хаос невозможно победить грубой сталью.', 
            EN: 'A severed maw steeps stone in caustic acid, and two sprout in its place. Chaos cannot be slain with heavy iron.' 
        } 
    },
    'a_cha_c': { 
        id: 'a_cha_c', tier: 'A', faction: 'chaos', role: 'Главком', cp: 2100, cap: 1640, icon: '🗡️', 
        name: { RU: 'Верховный Вождь Кланов', EN: 'Clan High Chieftain' }, 
        lore: { 
            RU: 'Сплотил непокорные племена ударом топора о наковальню великой бури. Его воины не преклоняют колен даже перед древними богами.', 
            EN: 'Unified rebellious tribes by striking greataxe upon the tempest anvil. His host bows to no pantheon.' 
        } 
    },
    'a_cha_r': { 
        id: 'a_cha_r', tier: 'A', faction: 'chaos', role: 'Тыл', cp: 1930, cap: 1460, icon: '🔮', 
        name: { RU: 'Чернокнижник Разлома', EN: 'Rift Warlock' }, 
        lore: { 
            RU: 'Он искривляет геометрию боя: стрелы врага разворачиваются обратно в лучников, а твердая земля под ногами оборачивается пустотой.', 
            EN: 'He distorts the spatial matrix of battle: arrows twist backward into archers, and the soil beneath feet turns to void.' 
        } 
    },

    // ==========================================
    // РАНГИ [S], [SS], [SSS] (ЭЛИТНЫЙ ПАНТЕОН)
    // ==========================================
    's_dem_c': { 
        id: 's_dem_c', tier: 'S', faction: 'demon', role: 'Главком', cp: 3800, cap: 3500, icon: '👁️', 
        name: { RU: 'Лилит, Тень Бездны', EN: 'Lilith, Void Shade' }, 
        lore: { 
            RU: '«Ты преклоняешь колено не передо мной, смертный. Ты сдаешься собственным потаенным желаниям, которым я лишь дала имя и голос.»', 
            EN: '"You bend knee not to my dread majesty, mortal. You surrender to your own clandestine lusts, to which I lent a voice."' 
        } 
    },
    's_cha_r': { 
        id: 's_cha_r', tier: 'S', faction: 'chaos', role: 'Тыл', cp: 3650, cap: 3400, icon: '🐍', 
        name: { RU: 'Горгона Медуза', EN: 'Gorgon Medusa' }, 
        lore: { 
            RU: 'Ее взгляд обращает плоть в известняк. Наступающие фаланги замирают каменными памятниками собственной безумной дерзости.', 
            EN: 'Her gaze petrifies marrow into limestone. Advancing cohorts freeze into commemorative monuments to their folly.' 
        } 
    },
    's_lig_v': { 
        id: 's_lig_v', tier: 'S', faction: 'light', role: 'Авангард', cp: 3850, cap: 3550, icon: '👑', 
        name: { RU: 'Архангел Уриэль', EN: 'Archangel Uriel' }, 
        lore: { 
            RU: 'Пылающий меч высшего правосудия выжигает саму память о грехе. Перед его ослепительным ликом склоняют знамена даже владыки Бездны.', 
            EN: 'The flaming brand of supreme justice scorches away memory of sin. Before his blinding brow, archfiends lower banners.' 
        } 
    },
    's_und_c': { 
        id: 's_und_c', tier: 'S', faction: 'undead', role: 'Главком', cp: 3900, cap: 3600, icon: '💀', 
        name: { RU: 'Король-Лич Вальдор', EN: 'Lich King Valdor' }, 
        lore: { 
            RU: '«Время — иллюзия теплокровных созданий. В моих ледяных чертогах даже биение сердец застывает в вечном покое.»', 
            EN: '"Time is a vanity of warm-blooded creatures. Inside my glacial halls, even heartbeats freeze into immutable stillness."' 
        } 
    },

    'ss_und_r': { 
        id: 'ss_und_r', tier: 'SS', faction: 'undead', role: 'Тыл', cp: 6800, cap: 8000, icon: '🦅', 
        name: { RU: 'Морриган, Вестница', EN: 'Morrigan Harbinger' }, 
        lore: { 
            RU: 'Там, где садится ее ворон, короны обращаются в ржавчину, а триумфальные гимны — в отходные молитвы. Она не начинает войн — она приходит за жатвой.', 
            EN: 'Where her raven alights, crowns rust and triumphal hymns sour into dirges. She starts no wars—she claims the yield.' 
        } 
    },
    'ss_dem_v': { 
        id: 'ss_dem_v', tier: 'SS', faction: 'demon', role: 'Авангард', cp: 7100, cap: 8500, icon: '🌋', 
        name: { RU: 'Титан Пропасти', EN: 'Abyssal Titan' }, 
        lore: { 
            RU: 'Рожден из расплавленного кремния в миг раскола мира. Его поступь сдвигает тектонические плиты, а дыхание испепеляет небесный свод.', 
            EN: 'Forged from molten silica when the world cracked. His tread fractures tectonic shelves; his exhalation chars the sky.' 
        } 
    },
    'ss_lig_c': { 
        id: 'ss_lig_c', tier: 'SS', faction: 'light', role: 'Главком', cp: 6950, cap: 8300, icon: '☀️', 
        name: { RU: 'Серафим Созидания', EN: 'Creation Seraph' }, 
        lore: { 
            RU: 'Свет столь первозданный, что смертные глаза сгорают от одного взгляда на его нимб. Он дарует вечную жизнь, навсегда стирая волю.', 
            EN: 'Light so primordial that mortal vision is vaporized at a glance. He grants eternal life by scouring away will.' 
        } 
    },
    'ss_cha_v': { 
        id: 'ss_cha_v', tier: 'SS', faction: 'chaos', role: 'Авангард', cp: 7150, cap: 8600, icon: '🌪️', 
        name: { RU: 'Колосс Хаоса', EN: 'Chaos Colossus' }, 
        lore: { 
            RU: 'Его тело — живая круговерть гравитационных аномалий и черных дыр. Он шагает сквозь вражеские полки, словно сквозь сухой бурьян.', 
            EN: 'His sinew is a maelstrom of gravitational singularities. He treads through armed legions as dry bramble.' 
        } 
    },

    'sss_cha_c': { 
        id: 'sss_cha_c', tier: 'SSS', faction: 'chaos', role: 'Главком', cp: 11800, cap: 20000, icon: '👑', 
        name: { RU: 'Астарта, Матерь Бездны', EN: 'Astarte, Void Mother' }, 
        lore: { 
            RU: '«Когда первые боги только высекали искру творения, я уже спала в тишине под их ногами. Бездна — не конец сущего, а колыбель, куда всё вернется на ночлег.»', 
            EN: '"When infant gods struck sparks of creation, I slumbered in the silence beneath. The Abyss is no end, but the cradle all returns to."' 
        } 
    },
    'sss_dem_v': { 
        id: 'sss_dem_v', tier: 'SSS', faction: 'demon', role: 'Тыл', cp: 12400, cap: 22000, icon: '🐉', 
        name: { RU: 'Бахамут, Бог Драконов', EN: 'Bahamut Dragon God' }, 
        lore: { 
            RU: 'Император астрального пламени. В его пасти бушует первобытный огонь, способный расплавить ткань мироздания обратно в первозданный хаос.', 
            EN: 'Emperor of astral wyrm-fire. In his maw roars the flame that liquefies reality back to primordial chaos.' 
        } 
    },
    'sss_lig_r': { 
        id: 'sss_lig_r', tier: 'SSS', faction: 'light', role: 'Тыл', cp: 12000, cap: 21000, icon: '✨', 
        name: { RU: 'Люминарис, Бог Солнца', EN: 'Luminaris, Sun God' }, 
        lore: { 
            RU: 'Абсолютный ослепительный свет, не знающий тени. Всё сущее перед его величием распадается на чистую золотую звездную пыль.', 
            EN: 'Absolute blinding light without shadow. All matter before his glory dissolves into consecrated golden dust.' 
        } 
    },
    'sss_und_v': { 
        id: 'sss_und_v', tier: 'SSS', faction: 'undead', role: 'Авангард', cp: 12600, cap: 23000, icon: '☠️', 
        name: { RU: 'Танатос, Жнец Вечности', EN: 'Thanatos, Eternity Reaper' }, 
        lore: { 
            RU: 'Воплощение неизбежного финала вселенной. Его серп опустится лишь однажды — в миг, когда в пустоте погаснет последняя звезда.', 
            EN: 'Embodiment of inevitable universal entropy. His scythe descends but once, when the final star goes cold in the void.' 
        } 
    }
};

// Круг стихийного превосходства (Камень-Ножницы-Бумага):
// Свет > Нежить > Хаос > Демоны > Свет (+15% CP)
const ELEMENTAL_ADVANTAGE = {
    'light': 'undead',
    'undead': 'chaos',
    'chaos': 'demon',
    'demon': 'light'
};

const TIER_ORDER = {
    'SSS': 9, 'SS': 8, 'S': 7, 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1
};

const DISMANTLE_RATES = {
    'F': 1, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 6, 'S': 10, 'SS': 15, 'SSS': 30
};

const DAILY_CALENDAR_REWARDS = [
    // НЕДЕЛЯ 1: СТАРТОВЫЙ ТРИУМФ (Дни 1–7)
    { day: 1, gold: 500, crystals: 10, relics: 0, hero: null },
    { day: 2, gold: 1200, crystals: 25, relics: 0, hero: null },
    { day: 3, gold: 1500, crystals: 30, relics: 0, hero: 'a_lig_v' },
    { day: 4, gold: 3000, crystals: 50, relics: 0, hero: null },
    { day: 5, gold: 5000, crystals: 75, relics: 0, hero: null },
    { day: 6, gold: 8000, crystals: 100, relics: 0, hero: null },
    { day: 7, gold: 10000, crystals: 150, relics: 0, hero: 'ss_und_r' },
    // НЕДЕЛЯ 2: МАРШ ЛЕГИОНОВ (Дни 8–14)
    { day: 8, gold: 10000, crystals: 100, relics: 0, hero: null },
    { day: 9, gold: 12000, crystals: 120, relics: 0, hero: null },
    { day: 10, gold: 15000, crystals: 150, relics: 0, hero: null },
    { day: 11, gold: 18000, crystals: 180, relics: 0, hero: null },
    { day: 12, gold: 20000, crystals: 200, relics: 0, hero: null },
    { day: 13, gold: 25000, crystals: 250, relics: 0, hero: null },
    { day: 14, gold: 25000, crystals: 300, relics: 0, hero: 'ss_dem_v' },
    // НЕДЕЛЯ 3: ТАЙНЫ ГЛУБИН (Дни 15–21)
    { day: 15, gold: 30000, crystals: 250, relics: 0, hero: null },
    { day: 16, gold: 35000, crystals: 280, relics: 0, hero: null },
    { day: 17, gold: 40000, crystals: 300, relics: 0, hero: null },
    { day: 18, gold: 45000, crystals: 350, relics: 0, hero: null },
    { day: 19, gold: 50000, crystals: 400, relics: 0, hero: null },
    { day: 20, gold: 60000, crystals: 450, relics: 0, hero: null },
    { day: 21, gold: 50000, crystals: 500, relics: 0, hero: 'ss_lig_c' },
    // НЕДЕЛЯ 4: АБСОЛЮТНЫЙ ПАНТЕОН (Дни 22–28)
    { day: 22, gold: 70000, crystals: 500, relics: 0, hero: null },
    { day: 23, gold: 80000, crystals: 550, relics: 0, hero: null },
    { day: 24, gold: 90000, crystals: 600, relics: 0, hero: null },
    { day: 25, gold: 100000, crystals: 700, relics: 0, hero: null },
    { day: 26, gold: 120000, crystals: 800, relics: 0, hero: null },
    { day: 27, gold: 150000, crystals: 900, relics: 0, hero: null },
    { day: 28, gold: 100000, crystals: 1000, relics: 1, hero: 'sss_dem_v' }
];

const EXPEDITIONS_CONFIG = [
    // FIX-BALANCE v4.7.0: золото ÷10, кристаллы ÷2.5, время ×2.
    // Экспедиции перестают быть мешком золота — приоритет долгосрочной инвестиции.
    // exp_1: 1ч / +180 золота / +2 C; exp_5: 16ч / +3500 / +40 C.
    // FIX-EXP-RELIC v4.7.0: relicChance урезан в 2.5 раза (было 8%/4%/2%).
    // 8% за 16ч на exp_5 при параллельной отправке — слишком щедро для "премиального"
    // ресурса. Новое: exp_5 = 3%, exp_4 = 1.5%, exp_3 = 0.7%. Плюс бонус моно-отряда
    // снижен с +4% до +1% (см. claimExpedition в engine.js).
    { id: 'exp_5', title: { RU: 'Сердце Первородной Бездны', EN: 'Heart of the Void' }, durationSec: 57600, requiredHeroes: 5, rewardGold: 3500, rewardCrystals: 40, relicChance: 0.008 },
    { id: 'exp_4', title: { RU: 'Пепельные Разломы', EN: 'Ashen Rifts' }, durationSec: 28800, requiredHeroes: 4, rewardGold: 1800, rewardCrystals: 20, relicChance: 0.004 },
    { id: 'exp_3', title: { RU: 'Астральный Лабиринт', EN: 'Astral Labyrinth' }, durationSec: 14400, requiredHeroes: 3, rewardGold: 850, rewardCrystals: 10, relicChance: 0.002 },
    { id: 'exp_2', title: { RU: 'Катакомбы Склепа', EN: 'Crypt Catacombs' }, durationSec: 7200, requiredHeroes: 2, rewardGold: 400, rewardCrystals: 6, relicChance: 0 },
    { id: 'exp_1', title: { RU: 'Дозор Глубин', EN: 'Depths Patrol' }, durationSec: 3600, requiredHeroes: 1, rewardGold: 180, rewardCrystals: 2, relicChance: 0 }
];

// v4.9.7: хелперы для каскадных достижений.
// geometricStages — прогрессия от start до end на count этапов.
// geometricRewards — награды с геометрическим ростом (не задирает бюджет).
const geometricStages = (start, end, count, roundFn = Math.round) => {
    if (count < 2) return [end];
    const ratio = Math.pow(end / start, 1 / (count - 1));
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(roundFn(start * Math.pow(ratio, i)));
    }
    return result;
};

const geometricRewards = (base, ratio, count) => {
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(Math.round(base * Math.pow(ratio, i)));
    }
    return result;
};

// FIX-DUPLICATE-HELPERS: дублирующий блок geometricStages/geometricRewards удалён.
// Второй `const geometricStages` вызывал SyntaxError, парсер JS останавливался,
// HEROES_CATALOG не создавался, игра ломалась после бампа ?v= в index.html.
// Первый блок (roundFn-вариант, выше) остаётся каноном.

const CASCADING_ACHIEVEMENTS = [
    { id: 'ach_g', title: { RU: 'Золотой Век', EN: 'Golden Age' }, descTemplate: { RU: 'Заработайте {val} <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"> за всё время', EN: 'Earn {val} <img src="assets/icons/gold.webp" class="res-icon-inline" alt="G"> lifetime' }, type: 'lifetime_gold', stages: geometricStages(2000, 100000000000, 50), rewardsC: geometricRewards(5, 1.10, 50) },
    { id: 'ach_a', title: { RU: 'Легион Бездны', EN: 'Abyss Legion' }, descTemplate: { RU: 'Соберите гарнизон в {val} воинов', EN: 'Amass army of {val}' }, type: 'max_army', stages: geometricStages(100, 20000000, 50), rewardsC: geometricRewards(5, 1.10, 50) },
    { id: 'ach_k', title: { RU: 'Неприступная Крепость', EN: 'Impregnable Keep' }, descTemplate: { RU: 'Улучшите Цитадель до Уровня {val}', EN: 'Citadel to Lvl {val}' }, type: 'highest_keep', stages: [5, 7, 9, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44, 46, 47, 48, 49, 50], rewardsC: geometricRewards(10, 1.20, 20) },
    { id: 'ach_ar', title: { RU: 'Гладиатор Арены', EN: 'Arena Gladiator' }, descTemplate: { RU: 'Одержите {val} побед на Арене', EN: 'Win {val} Arena duels' }, type: 'lifetime_wins', stages: geometricStages(5, 20000, 50), rewardsC: geometricRewards(5, 1.10, 50) },
    { id: 'ach_c', title: { RU: 'Повелитель Душ', EN: 'Lord of Souls' }, descTemplate: { RU: 'Разблокируйте {val} героев в Штабе', EN: 'Unlock {val} champions' }, type: 'cards_count', stages: [5, 10, 20, 35, 50, 70, 84], rewardsC: [15, 25, 50, 100, 200, 400, 800] },
    { id: 'ach_asc', title: { RU: 'Владыка Вечности', EN: 'Eternal Overlord' }, descTemplate: { RU: 'Накопите {val} Реликвий Возвышения', EN: 'Accumulate {val} Relics' }, type: 'total_relics', stages: geometricStages(1, 300, 50), rewardsC: geometricRewards(10, 1.15, 50) },
    { id: 'ach_dem', title: { RU: 'Охотник на Бесов', EN: 'Imp Hunter' }, descTemplate: { RU: 'Перехватите {val} летучих демонов', EN: 'Intercept {val} courier imps' }, type: 'demon_catches', stages: geometricStages(1, 20000, 50), rewardsC: geometricRewards(5, 1.10, 50) },
    { id: 'ach_dung', title: { RU: 'Покоритель Бездны', EN: 'Abyss Conqueror' }, descTemplate: { RU: 'Очистите от скверны {val} этажей', EN: 'Purge {val} Abyss floors' }, type: 'dungeon_floor', stages: geometricStages(5, 300, 50), rewardsC: geometricRewards(5, 1.10, 50) },
    { id: 'ach_wheel', title: { RU: 'Колесо Фортуны', EN: 'Wheel of Fortune' }, descTemplate: { RU: 'Прокрутите колесо {val} раз', EN: 'Spin the wheel {val} times' }, type: 'wheel_spins', stages: geometricStages(10, 5000, 50), rewardsC: geometricRewards(5, 1.10, 50) }
];