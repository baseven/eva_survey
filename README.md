# eva\_survey

## Введение

**eva\_survey** — это приложение для Frappe, позволяющий создавать и проводить опросы (аналог Google Forms) прямо в системе.

С помощью него вы можете:

* Создавать опросы с разными типами вопросов (Text, Single Choice, Multiple Choice, Scale, Date).
* Поддерживать анонимные и авторизованные опросы.
* Собирать и хранить ответы в DocType для последующего анализа.

## Установка

### Клонирование приложения

Выполните команду, чтобы клонировать приложение в папку с вашими приложениями bench:

```bash
bench get-app https://github.com/baseven/eva_survey.git
```

### Установка на сайт

Установите приложение на ваш сайт Frappe:

```bash
bench --site YOUR_SITE_NAME install-app eva_survey
bench migrate
```

Замените `YOUR_SITE_NAME` на имя вашего сайта.

## Создание опроса

Для создания опроса в UI Frappe используются следующие DocType:

1. **Eva Survey Item** — основной документ опроса.

   * **title** (Data) — название.
   * **description** (Small Text) — описание.
   * **is\_active** (Check) — активен ли опрос.
   * **is\_anonymous** (Check) — анонимный ли опрос.
   * **questions** (Table) — связанная таблица вопросов (Eva Survey Question).

2. **Eva Survey Question** — дочерний документ внутри `Eva Survey Item`.

   * **idx** (Int) — порядок отображения.
   * **question\_text** (Data) — текст вопроса.
   * **question\_type** (Select) — тип вопроса (`Text`, `Single Choice`, `Multiple Choice`, `Scale`, `Date`).
   * **options** (Small Text) — список вариантов (каждый вариант на новой строке).
   * **is\_required** (Check) — обязательно ли отвечать.

Чтобы создать новый опрос:

* Перейдите в **Eva Survey Item → New**.
* Заполните поля и добавьте вопросы через таблицу **questions**.
* Сохраните и опубликуйте.

После этого опрос появится на странице **/start-survey**.

## DocTypes ответов

После отправки опроса используются следующие DocType для хранения результатов:

3. **Eva Survey Response** — родительский документ одного прохождения опроса:

   * **survey** (Link → Eva Survey Item) — ссылка на опрос.
   * **respondent** (Link → User) — респондент (для авторизованных опросов).
   * **submission\_time** (Datetime) — дата и время отправки.
   * **answers** (Table) — дочерняя таблица ответов (Eva Survey Answer).

4. **Eva Survey Answer** — дочерняя таблица внутри `Eva Survey Response` для каждого ответа:

   * **idx** (Int) — порядок вопроса.
   * **question\_link** (Link → Eva Survey Question) — связь с вопросом.
   * **question\_text** (Data) — текст вопроса (для отчетов).
   * **answer\_text** (Data) — текстовый ответ (для Text).
   * **selected\_options** (Data) — выбранные варианты (для Single/Multiple Choice).
   * **scale\_value** (Int) — значение шкалы (для Scale).
   * **date\_value** (Date) — дата (для Date).

## Логика проведения опроса

1. Пользователь открывает **/start-survey** — видит список активных опросов (анонимные для всех, приватные — только для залогиненных).
2. При выборе опроса нажимает **Начать** и попадает на **/survey?survey=\<doc\_name>**.
3. Страница отображает все доступные вопросы.
4. После заполнения нажимаете **Отправить**.
5. Сервер сохраняет полученный ответы в Eva Survey Response DocType, где отображается информация о пройденном опросе и данные пользователем ответы.