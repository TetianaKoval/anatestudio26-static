import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { gameList } from './gameList.mjs';

const app = express();
const PORT = process.env.PORT || 3000;
// const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Налаштовуємо EJS як шаблонізатор за замовчуванням
app.set('view engine', 'ejs');
app.set('views', './views');

// Роздаємо статичні файли (CSS, картинки)
app.use(express.static('public'));

// Роздаємо locales/ як статичні файли (щоб scripts.ejs однаково працював і тут, і в статичній збірці)
app.use('/locales', express.static('locales'));

app.get('/favicon.ico', (req, res) => res.status(204).end());

//Meddleware для двомовності
app.use(async(req, res, next) => {
  // пропускаю запити до статичних файлів
  if (req.path.startsWith('/css') || req.path.startsWith('/images') || req.path.startsWith('/js') || req.path.includes('.')){
    return next();
  }

  // розділяю шлях на частинки. Наприклад: "/ua/games/the-kite" -> ["", "ua", "games", "the-kite"]
  const urlParts = req.path.split('/');

  // записую у змінну другу частинку ua або en
  let lang = urlParts[1];

  // перевіряю чи підходить якась з мов, якщо ні то ставлю по замовчуванню en
  if (lang !== 'ua' && lang !== 'en') {
    // якщо користувач зайшов просто на "/", редіректим на "/en"
    //якшо він зайшов на "/games/the-kite", редіректим на "/en/games/the-kite"

    const restOfPath = req.path === '/' ? '' : req.path;
    console.log(`неправильний шлях ${req.path}, перенаправляю на /en${restOfPath}`)
    return res.redirect(`/en${restOfPath}`);
  };

  try {
    // створюю шлях або locales/en.json або locales/ua.json
    const localePath = path.join(__dirname, 'locales', `${lang}.json`);
    // читаю цей файл
    const localeData = await fs.readFile(localePath, 'utf-8');

    // передаю дані про мову і переклад у ключі в об'єкті locals, так вони будуть доступні у файлах ejs
    res.locals.t = JSON.parse(localeData);
    res.locals.currentLang = lang;

    next();
  } catch (error) {
    console.error('помилка завантаження мовного файлу', error);
    res.status(500).send('Language initialization error');
  }
})

//маршрути

app.get('/:lang/api/translations', (req, res) => {
  // Оскільки Middleware вже прочитав файл локалізації і поклав його в res.locals.t,
  // ми просто повертаємо його клієнту (браузеру) як чистий JSON!
  res.json(res.locals.t);
});

app.get('/:lang', (req, res) => {
  res.render('index', { games: gameList });
});

app.get('/:lang/:category/:gameId', (req, res) => {
  const { gameId, category } = req.params;

  // шукаєм дану гру за id в gamesList
  const targetGame = gameList.find(game => game.id === gameId && game.category === category);

  if(!targetGame) {
    return res.redirect(`/${res.locals.currentLang}`)
  };

  //HTMX додає заголовок hx-request до кожного свого запиту

  const isHtmxRequest = req.headers['hx-request'] === 'true';

  if(isHtmxRequest) {
    res.render('game-detail', { game: targetGame });
  } else {
    res.render('game-page', { game: targetGame, games: gameList });
  }
});

app.listen(PORT, () => {
  console.log(`сайт AnateStudio процює на порті ${PORT}`)
})

