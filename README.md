# Caritas Admin Panel — caritas-vitania

Next.js + Firebase admin panel за Caritas Vitania.

**Firebase проект:** `caritas-vitania`
**Auth Domain:** `caritas-vitania.firebaseapp.com`

---

## Бързо стартиране

```bash
# 1. Инсталирай пакетите
npm install

# 2. Стартирай (ключовете са вече в .env.local)
npm run dev
```

Отвори: http://localhost:3000

---

## Firebase настройка (еднократно)

### 1. Authentication — включи Email/Password
Firebase Console → Authentication → Sign-in method → Email/Password → Enable

### 2. Firestore — създай база данни
Firebase Console → Firestore Database → Create database → Europe-west

### 3. Firestore Rules — копирай от firestore.rules файла
Firebase Console → Firestore → Rules → постни съдържанието на firestore.rules

### 4. Създай първи Admin потребител

**Стъпка А** — В Firebase Console → Authentication → Add user:
- Email: твоя имейл
- Password: твоя парола

**Стъпка Б** — В Firestore → users → Add document:
- Document ID = UID от Authentication (копирай го)
```json
{
  "email": "твоя@email.com",
  "displayName": "Никол Траянова",
  "role": "admin",
  "isOnline": false,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Деплой на Vercel

```bash
npm install -g vercel
vercel
```

Vercel автоматично чете .env.local при деплой.
Или добави ключовете ръчно в Vercel Dashboard → Settings → Environment Variables.

---

## Модули

| Модул | Route |
|---|---|
| Табло | /admin/dashboard |
| Заявки за дейности | /admin/requests |
| Бенефициенти | /admin/beneficiaries |
| Задачи | /admin/tasks |
| Работодатели | /admin/employers |
| Доброволци | /admin/volunteers |
| Дарители | /admin/donors |
| Export CSV | /admin/export |
| Потребители | /admin/users |
| Нотификации | /admin/notifications |

## Импорт и експорт на работодатели

В „Работодатели“ има бутони „Импорт“ (само администратор) и „Експорт Excel“.

- Експортът съдържа всички намерени работодатели при текущото търсене, не само текущата страница.
- Импортът приема `.xlsx`, `.xls` и UTF-8 `.csv`, до 10 MB и 5000 реда. Шаблонът се сваля от прозореца за импорт.
- Колони: ID, Наименование, ЕИК, Град, Адрес, Лице за контакт, Телефон, Имейл, Бранш, Бележки. Приемат се и английските имена на полетата. Наименованието е задължително.
- Телефоните и ЕИК се експортират като текст. При ръчно въвеждане в Excel използвайте текстов формат, за да не се загубят началните нули.
- Преди запис се показва преглед. Съществуващите записи се намират по ID, ЕИК или име и град и по подразбиране се пропускат. При изрично избрано обновяване се променят само попълнените полета.
- Повторен работодател във файла, противоречиви ID/ЕИК, липсващо име или невалиден имейл блокират целия импорт преди първия запис.
- Работните позиции, датата на създаване, създателят и отговорният потребител се запазват при обновяване. Файлът не променя права или разпределение на записи. Работните позиции не се включват в този табличен експорт.
- Записването е на партиди по 100 и има отчет за частично изпълнение при грешка. Повторен импорт след прекъсване отново проверява наличните записи. Резултатът се записва в „История“.

Проверки без достъп до продукционни данни:

```bash
node scripts/test-employer-transfer.cjs
npm run build
```
