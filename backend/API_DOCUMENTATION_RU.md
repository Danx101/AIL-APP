# API Документация - Abnehmen im Liegen

## Базовый URL
- Разработка: `http://localhost:3001/api/v1`
- Продакшн: `https://your-domain.com/api/v1`

## Аутентификация
JWT токен в заголовке: `Authorization: Bearer <token>`

---

## 🔐 Аутентификация

### Регистрация студии
**POST** `/auth/register-studio`
```json
{
  "email": "owner@studio.com",
  "password": "SecurePass123",
  "firstName": "Макс",
  "lastName": "Мустерманн",
  "phone": "+49176123456",
  "studioName": "AiL Берлин Центр",
  "studioAddress": "Hauptstraße 1, 10115",
  "studioCity": "Berlin",
  "studioPhone": "+493012345678"
}
```
**Ответ:** Требует подтверждения email

### Подтверждение email
**GET** `/auth/verify-email/:token`
**Ответ:** JWT токен + данные студии

### Регистрация клиента
**POST** `/auth/register-customer-enhanced`
```json
{
  "registrationCode": "BER-456",
  "email": "customer@email.com",
  "password": "password123",
  "sendVerificationEmail": true
}
```

### Проверка кода регистрации
**GET** `/auth/validate-code?code=BER-456`

### Вход
**POST** `/auth/login`
```json
{
  "email": "user@email.com",
  "password": "password123"
}
```

---

## 📊 Канбан лидов

### Получить канбан
**GET** `/kanban?studio_id=1`
**Ответ:** Лиды по статусам (new, working, qualified, trial_scheduled, converted, lost)

### Переместить лида
**PUT** `/leads/:id/move`
```json
{
  "to_status": "trial_scheduled",
  "appointment_data": {
    "date": "2025-01-15",
    "time": "14:00",
    "end_time": "15:00"
  }
}
```

### Конвертировать в клиента
**POST** `/leads/:id/convert`
```json
{
  "sessionPackage": 20,
  "paymentMethod": "cash",
  "notes": "После пробной тренировки"
}
```
**Важно:** Требуется покупка пакета сессий!

### Реактивировать лида
**POST** `/leads/:id/reactivate`
```json
{
  "target_status": "working"
}
```

### История активности
**GET** `/leads/:id/activities?limit=50`

### Добавить заметку
**POST** `/leads/:id/notes`
```json
{
  "note": "Интересуется пакетом на 20 сессий"
}
```

### Записать контакт
**POST** `/leads/:id/contact`
```json
{
  "contact_type": "call"
}
```

---

## 👥 Управление клиентами

### Создать клиента (с обязательными сессиями)
**POST** `/studios/:studioId/customers`
```json
{
  "firstName": "Анна",
  "lastName": "Шмидт",
  "phone": "+49176987654",
  "email": "anna@example.com",
  "sessionPackage": 20,
  "paymentMethod": "cash",
  "notes": "Предпочитает утро"
}
```
**Ответ:** Код регистрации (BER-789)

### Добавить сессии
**POST** `/customers/:id/sessions`
```json
{
  "total_sessions": 20,
  "payment_method": "card",
  "notes": "Докупка 20 сессий"
}
```

### Информация для регистрации
**GET** `/customers/:id/registration-info`

### Список клиентов студии
**GET** `/studios/:studioId/customers?page=1&limit=20&search=anna`

### Детали клиента
**GET** `/customers/:id`

### Обновить данные клиента
**PUT** `/customers/:id`
```json
{
  "contact_first_name": "Анна",
  "contact_last_name": "Шмидт-Майер",
  "contact_phone": "+49176987655",
  "contact_email": "anna.new@example.com"
}
```

---

## 🔍 Поиск

### Универсальный поиск (лиды + клиенты)
**GET** `/search/persons?type=all&query=max&studio_id=1`
- `type`: all, lead, customer
- `query`: минимум 2 символа

### Быстрый поиск (для записи)
**GET** `/search/quick?query=anna&studio_id=1`

---

## 📅 Записи на прием

### Создать запись
**POST** `/appointments`

**Для лида (только пробная):**
```json
{
  "studio_id": 1,
  "person_type": "lead",
  "lead_id": 123,
  "appointment_type_id": 3,
  "appointment_date": "2025-01-15",
  "start_time": "14:00",
  "end_time": "15:00"
}
```

**Для клиента:**
```json
{
  "studio_id": 1,
  "person_type": "customer",
  "customer_id": 456,
  "appointment_type_id": 1,
  "appointment_date": "2025-01-15",
  "start_time": "14:00",
  "end_time": "15:00"
}
```

### Получить записи студии
**GET** `/appointments?studio_id=1&date=2025-01-15`

### Обновить статус записи
**PUT** `/appointments/:id/status`
```json
{
  "status": "completed"
}
```

### Удалить запись
**DELETE** `/appointments/:id`

---

## 📦 Пакеты сессий

### Типы пакетов
- 10 сессий
- 20 сессий
- 30 сессий
- 40 сессий

### Получить активные пакеты клиента
**GET** `/customers/:id/blocks`

### История пакетов
**GET** `/customers/:id/session-history`

---

## 🏢 Управление студиями

### Получить данные студии
**GET** `/studios/:id`

### Обновить студию
**PUT** `/studios/:id`
```json
{
  "name": "Новое название",
  "address": "Новый адрес",
  "phone": "+49301234567"
}
```

### Статистика студии
**GET** `/studios/:id/stats`
- Количество лидов
- Количество клиентов
- Коэффициент конверсии
- Активные записи

---

## ❌ Коды ошибок

### 400 Bad Request
```json
{
  "message": "Ошибка валидации",
  "errors": [
    {
      "field": "email",
      "message": "Неверный формат email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Токен недействителен или истек"
}
```

### 403 Forbidden
```json
{
  "message": "Нет доступа к ресурсу"
}
```

### 404 Not Found
```json
{
  "message": "Ресурс не найден"
}
```

### 500 Internal Server Error
```json
{
  "message": "Внутренняя ошибка сервера"
}
```

---

## 🔄 Переходы статусов лидов

**Разрешенные переходы:**
- `new` → `working`, `unreachable`, `wrong_number`
- `working` → `qualified`, `not_interested`, `unreachable`
- `qualified` → `trial_scheduled`, `not_interested`
- `trial_scheduled` → `converted`, `lost`

**Архивные статусы:**
- Позитивные: `converted`
- Негативные: `unreachable`, `wrong_number`, `not_interested`, `lost`

---

## 📊 Метрики и отчеты

### Метрики канбана
**GET** `/kanban/metrics?studio_id=1`
- Коэффициент конверсии
- Среднее время конверсии
- Активные/архивные лиды
- Общее количество конвертированных

### Отчет по клиентам
**GET** `/reports/customers?studio_id=1&from=2025-01-01&to=2025-01-31`

---

## 🔑 Важные примечания

1. **Обязательные сессии**: При создании клиента ВСЕГДА требуется пакет сессий
2. **Коды регистрации**: Генерируются автоматически (формат: XXX-YYY)
3. **Идентификаторы студий**: Присваиваются по городу (BER, MUC, HAM и т.д.)
4. **Пробные тренировки**: Только для лидов со статусом trial_scheduled
5. **Email верификация**: Обязательна для владельцев студий, опциональна для клиентов

---

## 🚀 Быстрый старт

### 1. Создать студию и получить токен
```bash
# Регистрация
curl -X POST http://localhost:3001/api/v1/auth/register-studio \
  -H "Content-Type: application/json" \
  -d '{"email":"test@studio.com", "password":"Test123", ...}'

# Подтвердить email → получить токен
```

### 2. Создать лида
```bash
curl -X POST http://localhost:3001/api/v1/leads \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Иван Иванов", "phone":"+49176123456"}'
```

### 3. Конвертировать в клиента
```bash
curl -X POST http://localhost:3001/api/v1/leads/1/convert \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionPackage":20, "paymentMethod":"cash"}'
```

---

## 📝 Лимиты

- Запросов в минуту: 100 на IP
- Размер запроса: макс. 10MB
- Время ответа: макс. 30 сек

---

*Версия: 1.0.0*
*Обновлено: 2025-01-13*