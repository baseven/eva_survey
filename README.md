# eva\_survey

## Введение

**eva\_survey** — приложение для Frappe, позволяющее создавать шаблоны опросов, публиковать опросы с ограниченным сроком действия и собирать ответы как от авторизованных, так и анонимных пользователей.
С помощью него вы можете:

* Создавать шаблоны опросов с различными типами вопросов (Text, Single Choice, Multiple Choice, Scale, Percentage).
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

Для создания шаблона опроса в UI Frappe используются следующие DocType:

1. **Eva Survey Template** — шаблон опроса.

   * **title** (Data) — название.
   * **description** (Small Text) — описание.
   * **is\_active** (Check) — активен ли опрос.
   * **is\_anonymous** (Check) — анонимный ли опрос.
   * **questions** (Table) — связанная таблица вопросов (Eva Survey Question).
   * **published_surveys** — Таблица опубликованных опросов (DocType: Eva Survey Link)

2. **Eva Survey Instance** — опубликованный опрос.

   * **title** (Data) — название.
   * **description** (Small Text) — описание.
   * **start_date / end_date** (Datetime) — Срок действия опроса.
   * **is\_anonymous** (Check) — анонимный ли опрос.
   * **unique_link** (Link) — Уникальная ссылка для прохождения
   * **questions** (Table) — связанная таблица вопросов (Eva Survey Question).

3. **Eva Survey Link** — Связь с шаблоном.

   * **survey_link** (Link) — Публичная ссылка на опрос
   * **survey_instance** (Link) — Ссылка на опубликованный экземпляр опроса

4. **Eva Survey Question** — дочерний документ внутри `Eva Survey Template` и `Eva Survey Instance`.

   * **question\_text** (Data) — текст вопроса.
   * **question\_type** (Select) — тип вопроса (`Text`, `Single Choice`, `Multiple Choice`, `Scale`, `Percentage`).
   * **options** (Small Text) — список вариантов (каждый вариант на новой строке).
   * **is\_required** (Check) — обязательно ли отвечать.

Чтобы создать новый опрос:

* Перейдите в **Eva Survey Item → New**.
* Заполните поля и добавьте вопросы через таблицу **questions**.
* Сохраните и опубликуйте.

После этого опрос появится на странице **/start-survey**.

## DocTypes ответов

После отправки опроса используются следующие DocType для хранения результатов:

1. **Eva Survey Response** — родительский документ одного прохождения опроса:

   * **survey_instance** (Link → Eva Survey Item) — ссылка на опрос.
   * **respondent** (Link → User) — респондент (для авторизованных опросов).
   * **submission\_time** (Datetime) — дата и время отправки.
   * **answers** (Table) — дочерняя таблица ответов (Eva Survey Answer).

2. **Eva Survey Answer** — дочерняя таблица внутри `Eva Survey Response` для каждого ответа:

   * **idx** (Int) — порядок вопроса.
   * **question\_link** (Link → Eva Survey Question) — связь с вопросом.
   * **question\_text** (Data) — текст вопроса (для отчетов).
   * **answer\_text** (Data) — текстовый ответ (для Text).
   * **selected\_options** (Data) — выбранные варианты (для Single/Multiple Choice).
   * **scale\_value** (Int) — значение шкалы (для Scale).
   * **date\_value** (Date) — дата (для Date).

## Логика проведения опроса

1. Администратор публикует опрос на странице /survey-admin.
2. Пользователь переходит по сгенерированной ссылке /survey/<unique_link>. 
3. Открывается форма с вопросами. 
4. Пользователь заполняет и отправляет ответы. 
5. Ответы сохраняются в Eva Survey Response. 
6. Неанонимный опрос можно пройти только один раз.

## Ограничения
1. Опросы становятся недоступными вне периода активности. 
2. Опросы с флагом anonymous = false требуют авторизации. 
3. Повторное прохождение запрещено для неанонимных опросов.

## Администрирование
Администратор управляет публикацией опросов на странице /survey-admin, выбирает шаблон и настраивает параметры публикации (название, даты, анонимность).