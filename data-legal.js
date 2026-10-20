/* ==========================================================
   LORDS OF THE ABYSS — ВСТРОЕННЫЕ ПРАВОВЫЕ ДОКУМЕНТЫ (data-legal.js)
   Версия 1.0
   
   Назначение: обеспечить чтение юридических документов ВНУТРИ игрового
   iframe без открытия внешнего окна. Это устраняет проблему дублирования
   VK-сессий при клике «Соглашение» / «Конфиденциальность».
   
   Внешние HTML-файлы terms.html и privacy.html остаются в репозитории:
   они нужны для полей «Правовые документы» в VK Console (п. 1.1.4) и
   используются как публичная копия документов.
   
   Источник текста: terms.html / privacy.html (дословный перенос).
   При правке юр. текста — обновлять синхронно оба места.
   ========================================================== */

const LEGAL_DOCS = {
    // ==========================================
    // ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ
    // ==========================================
    terms: {
        RU: {
            title: 'ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ',
            updated: 'Редакция от 12 октября 2026 года',
            sections: [
                { 
                    heading: '1. Общие положения', 
                    paragraphs: [
                        'Настоящее Пользовательское соглашение (далее — Соглашение) регулирует отношения между разработчиком игры «Lords of the Abyss» (далее — Разработчик) и пользователем (далее — Пользователь) при использовании игрового приложения, размещённого на платформе VK Mini Apps и доступного по адресу vk.com/app54817477.',
                        'Используя Игру, Пользователь подтверждает, что ознакомился с условиями Соглашения и принимает их в полном объёме.'
                    ]
                },
                {
                    heading: '2. Предмет соглашения',
                    paragraphs: [
                        'Разработчик предоставляет Пользователю неисключительное право использования Игры в развлекательных целях в объёме функциональных возможностей, реализованных на момент обращения.',
                        'Игра является многопользовательским развлекательным продуктом в жанре карточной стратегии и кликера. Все игровые механики предоставляются «как есть».'
                    ]
                },
                {
                    heading: '3. Возрастные ограничения',
                    paragraphs: [
                        'Игра содержит сцены фэнтезийного насилия, мрачную эстетику и тематический контент, не предназначенный для детей. Рекомендованный возраст — 16+.'
                    ]
                },
                {
                    heading: '4. Права на контент',
                    paragraphs: [
                        'Все элементы Игры — художественные изображения, тексты, игровые механики, код — являются интеллектуальной собственностью Разработчика. Копирование, распространение или коммерческое использование материалов Игры без письменного разрешения запрещено.',
                        'Пользователь не получает прав на игровые материалы. Всё, что отображается в Игре, предоставляется исключительно для личного некоммерческого использования.'
                    ]
                },
                {
                    heading: '5. Запрещённые действия',
                    paragraphs: ['Пользователю запрещается:'],
                    list: [
                        'использовать сторонние программы, скрипты или модификации для изменения игрового баланса;',
                        'предпринимать попытки взлома, декомпиляции или обхода серверных проверок;',
                        'выдавать себя за других пользователей или Разработчика;',
                        'использовать оскорбительные имена, нарушающие законодательство РФ;',
                        'совершать действия, направленные на нарушение работы Игры или её инфраструктуры.'
                    ]
                },
                {
                    heading: '6. Виртуальные ценности',
                    paragraphs: [
                        'В Игре используются виртуальные ценности: Золото, Кристаллы, Реликвии, Билеты Арены. Все виртуальные ценности:'
                    ],
                    list: [
                        'не имеют денежной стоимости и не могут быть обменены на реальные деньги;',
                        'не могут быть выведены за пределы Игры;',
                        'не подлежат передаче между пользователями;',
                        'могут быть изменены Разработчиком в рамках балансировки игровых механик.'
                    ],
                    trailingParagraphs: [
                        'Покупка виртуальных ценностей осуществляется через платёжные инструменты платформы VK. Разработчик не обрабатывает платёжные данные Пользователя.',
                        'В случае добровольного использования функции «Сбросить прогресс» (Hard Reset) Пользователь безвозвратно утрачивает все виртуальные ценности (Золото, Кристаллы, Реликвии, Билеты, Герои), полученные как за игровую активность, так и за реальные денежные средства. Исключением является только оплаченный VIP-статус, срок действия которого сохраняется. Разработчик не осуществляет возврат денежных средств за виртуальные ценности, утраченные в результате добровольного сброса прогресса.'
                    ]
                },
                {
                    heading: '7. Ответственность',
                    paragraphs: [
                        'Игра предоставляется на условиях «как есть». Разработчик не гарантирует бесперебойную работу Игры и не несёт ответственности за возможные технические сбои, вызванные сторонними факторами.',
                        'Разработчик вправе вносить изменения в игровые механики, баланс и функциональность без предварительного уведомления.'
                    ]
                },
                {
                    heading: '8. Изменение условий',
                    paragraphs: [
                        'Разработчик вправе изменять условия Соглашения. Актуальная редакция всегда доступна в официальном сообществе игры (vk.ru/lordsabyss). Продолжение использования Игры после внесения изменений означает согласие с новой редакцией.'
                    ]
                },
                {
                    heading: '9. Контакты',
                    paragraphs: ['По всем вопросам, связанным с Игрой, Пользователь может обратиться к Разработчику:'],
                    list: [
                        'Официальное сообщество игры: {{vk.ru/lordsabyss}}',
                        'Служба поддержки пользователей: {{vk.me/lordsabyss}}'
                    ],
                    trailingParagraphs: ['Срок ответа на обращение — не позднее 7 календарных дней с момента отправки.']
                }
            ]
        },
        EN: {
            title: 'TERMS OF USE',
            updated: 'Revised October 12, 2026',
            sections: [
                {
                    heading: '1. General Provisions',
                    paragraphs: [
                        'This Terms of Use Agreement (hereinafter — the Agreement) governs the relationship between the developer of the game "Lords of the Abyss" (hereinafter — the Developer) and the user (hereinafter — the User) when using the game application hosted on the VK Mini Apps platform and available at vk.com/app54817477.',
                        'By using the Game, the User confirms that they have read the terms of the Agreement and accept them in full.'
                    ]
                },
                {
                    heading: '2. Subject of the Agreement',
                    paragraphs: [
                        'The Developer grants the User a non-exclusive right to use the Game for entertainment purposes within the scope of functionality implemented at the time of access.',
                        'The Game is a multiplayer entertainment product in the card strategy and clicker genre. All game mechanics are provided "as is".'
                    ]
                },
                {
                    heading: '3. Age Restrictions',
                    paragraphs: [
                        'The Game contains scenes of fantasy violence, dark aesthetics, and thematic content not intended for children. Recommended age — 16+.'
                    ]
                },
                {
                    heading: '4. Content Rights',
                    paragraphs: [
                        'All elements of the Game — artwork, texts, game mechanics, code — are the intellectual property of the Developer. Copying, distribution, or commercial use of the Game materials without written permission is prohibited.',
                        'The User does not acquire rights to the game materials. Everything displayed in the Game is provided solely for personal non-commercial use.'
                    ]
                },
                {
                    heading: '5. Prohibited Actions',
                    paragraphs: ['The User is prohibited from:'],
                    list: [
                        'using third-party programs, scripts, or modifications to alter game balance;',
                        'attempting to hack, decompile, or bypass server-side checks;',
                        'impersonating other users or the Developer;',
                        'using offensive names that violate the laws of the Russian Federation;',
                        'committing actions aimed at disrupting the operation of the Game or its infrastructure.'
                    ]
                },
                {
                    heading: '6. Virtual Valuables',
                    paragraphs: [
                        'The Game uses virtual valuables: Gold, Crystals, Relics, Arena Tickets. All virtual valuables:'
                    ],
                    list: [
                        'have no monetary value and cannot be exchanged for real money;',
                        'cannot be withdrawn outside the Game;',
                        'cannot be transferred between users;',
                        'may be modified by the Developer as part of game mechanics balancing.'
                    ],
                    trailingParagraphs: [
                        'Purchase of virtual valuables is carried out via the payment instruments of the VK platform. The Developer does not process the User\'s payment data.',
                        'In the event of voluntary use of the "Reset Progress" (Hard Reset) function, the User irrevocably loses all virtual valuables (Gold, Crystals, Relics, Tickets, Heroes) obtained both through gameplay and real money. The only exception is the paid VIP status, the duration of which is preserved. The Developer does not refund money for virtual valuables lost as a result of a voluntary progress reset.'
                    ]
                },
                {
                    heading: '7. Liability',
                    paragraphs: [
                        'The Game is provided on an "as is" basis. The Developer does not guarantee uninterrupted operation of the Game and is not liable for possible technical failures caused by third-party factors.',
                        'The Developer reserves the right to modify game mechanics, balance, and functionality without prior notice.'
                    ]
                },
                {
                    heading: '8. Changes to Terms',
                    paragraphs: [
                        'The Developer reserves the right to change the terms of the Agreement. The current version is always available in the official game community (vk.ru/lordsabyss). Continued use of the Game after changes are made constitutes acceptance of the new version.'
                    ]
                },
                {
                    heading: '9. Contacts',
                    paragraphs: ['For any questions related to the Game, the User may contact the Developer:'],
                    list: [
                        'Official community: {{vk.ru/lordsabyss}}',
                        'User support: {{vk.me/lordsabyss}}'
                    ],
                    trailingParagraphs: ['Response time — no later than 7 calendar days from the moment of sending.']
                }
            ]
        }
    },

    // ==========================================
    // ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ
    // ==========================================
    privacy: {
        RU: {
            title: 'ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ',
            updated: 'Редакция от 12 октября 2026 года',
            sections: [
                {
                    heading: '1. Общие положения',
                    paragraphs: [
                        'Настоящая Политика конфиденциальности определяет порядок обработки данных пользователей в игре «Lords of the Abyss» (далее — Игра), размещённой на платформе VK Mini Apps.',
                        'Игра построена по архитектуре Zero-Server: у Разработчика отсутствует собственный сервер, собирающий персональные данные. Все игровые процессы выполняются на стороне клиента в браузере или WebView.'
                    ]
                },
                {
                    heading: '2. Какие данные обрабатываются',
                    paragraphs: ['Игра обрабатывает минимальный объём технических данных, необходимых для сохранения игрового прогресса:'],
                    list: [
                        'VK ID — идентификатор пользователя ВКонтакте, получаемый автоматически через VK Bridge при запуске. Используется исключительно для привязки игрового прогресса к аккаунту.',
                        'Игровое состояние — уровень героев, ресурсы, ранги и другие игровые показатели.',
                        'Настройки — язык интерфейса, громкость звука, выбранный аватар.'
                    ]
                },
                {
                    heading: '3. Какие данные НЕ обрабатываются',
                    paragraphs: ['Игра не запрашивает и не обрабатывает:'],
                    list: [
                        'фамилию, имя, отчество (кроме отображаемого ника, который пользователь сам задаёт);',
                        'номер телефона;',
                        'адрес электронной почты;',
                        'паспортные данные и любые другие документы;',
                        'геолокацию;',
                        'доступ к контактам, сообщениям, фотографиям или другим личным данным профиля VK.'
                    ]
                },
                {
                    heading: '4. Цели обработки данных',
                    paragraphs: ['Единственная цель обработки данных — обеспечение корректной работы Игры:'],
                    list: [
                        'сохранение и восстановление игрового прогресса;',
                        'синхронизация прогресса между устройствами через облачное хранилище платформы VK;',
                        'корректное отображение никнейма и аватара пользователя;',
                        'подсчёт игровых рейтингов и показателей.'
                    ]
                },
                {
                    heading: '5. Способы хранения данных',
                    paragraphs: ['Данные хранятся двумя способами:'],
                    list: [
                        'Локально на устройстве пользователя — через механизм localStorage браузера.',
                        'Облачно на серверах VK — через официальный API платформы VKWebAppStorageSet. При этом Разработчик не имеет прямого доступа к серверам VK и не хранит копий данных на своей стороне.'
                    ]
                },
                {
                    heading: '6. Передача данных третьим лицам',
                    paragraphs: [
                        'Разработчик не передаёт данные пользователей третьим лицам. Никакие данные не продаются, не используются для рекламных целей и не предоставляются сторонним аналитическим сервисам.',
                        'Данные могут быть доступны Администрации платформы VK в рамках её собственной инфраструктуры и политики конфиденциальности VK.'
                    ]
                },
                {
                    heading: '7. Права пользователя',
                    paragraphs: ['Пользователь вправе:'],
                    list: [
                        'удалить весь игровой прогресс — через кнопку «Сбросить прогресс» в настройках Игры. Все локальные и облачные данные будут обнулены в течение 24 часов. При этом все виртуальные ценности удаляются без возможности восстановления (исключение — оплаченный VIP-статус).',
                        'прекратить обработку данных — достаточно прекратить использование Игры и удалить приложение из профиля VK.',
                        'запросить сведения об обработке своих данных через обращение к Разработчику.'
                    ]
                },
                {
                    heading: '8. Безопасность',
                    paragraphs: [
                        'Все передачи данных между игрой и серверами VK осуществляются по защищённому протоколу HTTPS. В Игре не хранятся пароли, платёжные данные или иные конфиденциальные сведения.'
                    ]
                },
                {
                    heading: '9. Изменения политики',
                    paragraphs: [
                        'Разработчик вправе изменять настоящую Политику. Актуальная редакция всегда доступна в официальном сообществе игры (vk.ru/lordsabyss). Дата последнего обновления указана в начале документа.'
                    ]
                },
                {
                    heading: '10. Контакты',
                    paragraphs: ['По вопросам обработки данных Пользователь может обратиться к Разработчику:'],
                    list: [
                        'Официальное сообщество игры: {{vk.ru/lordsabyss}}',
                        'Служба поддержки пользователей: {{vk.me/lordsabyss}}'
                    ],
                    trailingParagraphs: ['Срок ответа — не позднее 7 календарных дней с момента обращения.']
                }
            ]
        },
        EN: {
            title: 'PRIVACY POLICY',
            updated: 'Revised October 12, 2026',
            sections: [
                {
                    heading: '1. General Provisions',
                    paragraphs: [
                        'This Privacy Policy defines the procedure for processing user data in the game "Lords of the Abyss" (hereinafter — the Game), hosted on the VK Mini Apps platform.',
                        'The Game is built on a Zero-Server architecture: the Developer has no own server collecting personal data. All game processes run on the client side in the browser or WebView.'
                    ]
                },
                {
                    heading: '2. What Data Is Processed',
                    paragraphs: ['The Game processes a minimal amount of technical data necessary to save game progress:'],
                    list: [
                        'VK ID — VKontakte user identifier, obtained automatically via VK Bridge on launch. Used solely to bind game progress to the account.',
                        'Game state — hero levels, resources, ranks, and other game metrics.',
                        'Settings — interface language, sound volume, chosen avatar.'
                    ]
                },
                {
                    heading: '3. What Data Is NOT Processed',
                    paragraphs: ['The Game does not request or process:'],
                    list: [
                        'surname, first name, patronymic (except the display nickname set by the user themselves);',
                        'phone number;',
                        'email address;',
                        'passport data and any other documents;',
                        'geolocation;',
                        'access to contacts, messages, photos, or other personal data of the VK profile.'
                    ]
                },
                {
                    heading: '4. Purposes of Data Processing',
                    paragraphs: ['The sole purpose of data processing is to ensure the correct operation of the Game:'],
                    list: [
                        'saving and restoring game progress;',
                        'synchronizing progress between devices via the VK cloud storage;',
                        'correct display of the user\'s nickname and avatar;',
                        'calculating game ratings and metrics.'
                    ]
                },
                {
                    heading: '5. Data Storage Methods',
                    paragraphs: ['Data is stored in two ways:'],
                    list: [
                        'Locally on the user\'s device — via the browser localStorage mechanism.',
                        'In the cloud on VK servers — via the official platform API VKWebAppStorageSet. The Developer has no direct access to VK servers and does not keep copies of data on their side.'
                    ]
                },
                {
                    heading: '6. Transfer of Data to Third Parties',
                    paragraphs: [
                        'The Developer does not transfer user data to third parties. No data is sold, used for advertising purposes, or provided to third-party analytics services.',
                        'Data may be accessible to the VK platform administration within its own infrastructure and VK privacy policy.'
                    ]
                },
                {
                    heading: '7. User Rights',
                    paragraphs: ['The User has the right to:'],
                    list: [
                        'delete all game progress — via the "Reset progress" button in the Game settings. All local and cloud data will be zeroed within 24 hours. All virtual valuables are deleted without the possibility of recovery (except for the paid VIP status).',
                        'cease data processing — simply stop using the Game and remove the application from the VK profile.',
                        'request information about the processing of their data by contacting the Developer.'
                    ]
                },
                {
                    heading: '8. Security',
                    paragraphs: [
                        'All data transmissions between the game and VK servers are carried out over the secure HTTPS protocol. The Game does not store passwords, payment data, or other confidential information.'
                    ]
                },
                {
                    heading: '9. Policy Changes',
                    paragraphs: [
                        'The Developer reserves the right to modify this Policy. The current version is always available in the official game community (vk.ru/lordsabyss). The date of the last update is indicated at the beginning of the document.'
                    ]
                },
                {
                    heading: '10. Contacts',
                    paragraphs: ['For questions regarding data processing, the User may contact the Developer:'],
                    list: [
                        'Official community: {{vk.ru/lordsabyss}}',
                        'User support: {{vk.me/lordsabyss}}'
                    ],
                    trailingParagraphs: ['Response time — no later than 7 calendar days from the moment of contacting.']
                }
            ]
        }
    }
};