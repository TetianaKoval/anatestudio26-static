import ejs from 'ejs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { gameList } from './gameList.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');
const VIEWS_DIR = path.join(__dirname, 'views');

async function loadLocale(lang) {
  const data = await fs.readFile(path.join(__dirname, 'locales', `${lang}.json`), 'utf-8');
  return JSON.parse(data);
}

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  const languages = ['en', 'ua'];

  for (const lang of languages) {
    const t = await loadLocale(lang);

    // Головна сторінка: views/index.ejs -> dist/en/index.html (і dist/ua/index.html)
    const indexHtml = await ejs.renderFile(
      path.join(VIEWS_DIR, 'index.ejs'),
      { games: gameList, t, currentLang: lang }
    );
    await writeFile(path.join(DIST_DIR, lang, 'index.html'), indexHtml);

    // Сторінка кожної гри: views/game-page.ejs -> dist/en/games/<id>/index.html
    for (const game of gameList) {
      const gameHtml = await ejs.renderFile(
        path.join(VIEWS_DIR, 'game-page.ejs'),
        { game, t, currentLang: lang }
      );
      await writeFile(path.join(DIST_DIR, lang, 'games', game.id, 'index.html'), gameHtml);
    }

    console.log(`Згенеровано сторінки для мови: ${lang}`);
  }

  // CSS та картинки — копіюємо як є
  await copyDir(path.join(__dirname, 'public', 'css'), path.join(DIST_DIR, 'css'));
  await copyDir(path.join(__dirname, 'public', 'images'), path.join(DIST_DIR, 'images'));

  // Переклади як звичайні статичні JSON-файли (замість /:lang/api/translations)
  await fs.mkdir(path.join(DIST_DIR, 'locales'), { recursive: true });
  await fs.copyFile(path.join(__dirname, 'locales', 'en.json'), path.join(DIST_DIR, 'locales', 'en.json'));
  await fs.copyFile(path.join(__dirname, 'locales', 'ua.json'), path.join(DIST_DIR, 'locales', 'ua.json'));

  // Кореневий index.html: заміна серверного редіректу "/" -> "/en"
  const rootRedirect = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>
    const browserLang = navigator.language.slice(0, 2);
    const lang = browserLang === 'uk' ? 'ua' : 'en';
    window.location.replace('/' + lang + '/');
  </script>
  <meta http-equiv="refresh" content="0; url=/en/">
</head>
<body>
  <p>Redirecting... <a href="/en/">Click here if not redirected</a></p>
</body>
</html>`;
  await writeFile(path.join(DIST_DIR, 'index.html'), rootRedirect);

  console.log('Готово! Статичний сайт згенеровано у папці dist/');
}

build().catch((err) => {
  console.error('Помилка збірки:', err);
  process.exit(1);
});
