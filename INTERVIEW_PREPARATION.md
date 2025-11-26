# Подготовка к интервью: Secure Livestream Viewer

## Обзор проекта

Проект представляет собой React-приложение для безопасного просмотра YouTube livestream с контролем доступа и отслеживанием взаимодействий пользователя (play, pause, seek). Приложение демонстрирует современные практики React-разработки, управление побочными эффектами и тестируемость.

---

## 1. Структура компонентов и логики

### Архитектура компонентов

Проект следует принципу **разделения ответственности (Separation of Concerns)** и использует **композицию компонентов**:

```
App (Container Component)
├── YouTubePlayer (Smart Component)
│   ├── YouTubeApiLoader (Module Singleton)
│   └── extractVideoId (Utility Function)
└── EventLog (Presentational Component)
    ├── formatClock (Utility)
    ├── formatDuration (Utility)
    └── formatDetail (Utility)
```

### Принципы проектирования

#### 1.1 Разделение на Container и Presentational компоненты

**App.jsx** - Container Component:
- Управляет состоянием приложения (`isLoggedIn`, `events`, `videoId`)
- Обрабатывает бизнес-логику (авторизация, логирование событий)
- Координирует взаимодействие между компонентами

**EventLog.jsx** - Presentational Component:
- Получает данные через props (`events`)
- Не имеет собственного состояния
- Фокусируется только на отображении
- Экспортирует утилиты для форматирования (тестируемость)

#### 1.2 Dependency Injection (DI)

Компонент `YouTubePlayer` использует DI для всех внешних зависимостей:

```javascript
export default function YouTubePlayer({
  videoId,
  onTrack,
  onVideoIdChange,
  playerFactory,      // ← Инжектируется для тестирования
  playerStates,       // ← Инжектируется для тестирования
})
```

**Преимущества:**
- Полная тестируемость без реального YouTube API
- Возможность подмены зависимостей
- Следование принципу Inversion of Control

#### 1.3 Модуль-синглтон для загрузки API

```javascript
const YouTubeApiLoader = (() => {
  let apiPromise = null;
  
  const loadYouTubeIframeApi = () => {
    // Логика загрузки с кешированием промиса
  };
  
  const reset = () => {
    apiPromise = null; // Для тестов
  };
  
  return { loadYouTubeIframeApi, reset };
})();
```

**Почему модуль-синглтон:**
- Предотвращает множественную загрузку API
- Инкапсулирует состояние в замыкании
- Предоставляет метод `reset()` для тестов

#### 1.4 Экспорт утилит для тестируемости

Все утилиты экспортируются:
- `formatClock`, `formatDuration`, `formatDetail` (EventLog)
- `loadYouTubeIframeApi`, `defaultPlayerFactory`, `extractVideoId` (YouTubePlayer)

**Причина:** Позволяет тестировать бизнес-логику изолированно от компонентов.

### Управление состоянием

#### Локальное состояние (useState)
- `isLoggedIn` - состояние авторизации
- `events` - массив событий взаимодействия
- `videoId` - текущий ID видео
- `ready` - готовность плеера

#### Мемоизация (useMemo, useCallback)
```javascript
const logEvent = useCallback((payload) => {
  // Мемоизация предотвращает лишние пересоздания
}, []);

const statusCopy = useMemo(
  () => isLoggedIn ? '...' : '...',
  [isLoggedIn]
);
```

**Зачем:** Предотвращает лишние ре-рендеры дочерних компонентов.

#### Использование refs для стабильных ссылок

```javascript
const onTrackRef = useRef(onTrack);

useEffect(() => {
  onTrackRef.current = onTrack; // Всегда актуальная версия
}, [onTrack]);
```

**Проблема, которую решает:** `onTrack` может меняться, но мы не хотим пересоздавать весь `useEffect` при каждом изменении.

---

## 2. Подход к Access Control и Video Embedding

### 2.1 Access Control (Контроль доступа)

#### Условный рендеринг на основе состояния

```javascript
{!isLoggedIn ? (
  <div className="player-placeholder">
    {/* Placeholder с сообщением о необходимости входа */}
  </div>
) : (
  <YouTubePlayer videoId={videoId} ... />
)}
```

**Принцип:** Компонент плеера вообще не рендерится для неавторизованных пользователей.

#### Визуальная обратная связь

- Показывается placeholder с иконкой замка
- Четкое сообщение о необходимости входа
- Кнопка входа прямо в placeholder (UX)

#### Production-ready подход

Хотя используется простой toggle для демо, структура позволяет легко заменить на реальную авторизацию:
- Состояние `isLoggedIn` может быть подключено к реальному auth provider
- Логика контроля доступа изолирована в одном месте

### 2.2 Video Embedding

#### Двойной подход: iframe + YouTube Iframe API

**1. Базовый iframe (fallback):**
```javascript
<iframe
  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1&controls=1`}
  key={videoId} // ← Пересоздание при смене видео
/>
```

**2. YouTube Iframe API (для событий):**
```javascript
playerInstance = factory(containerRef.current, videoId, {
  onReady: () => setReady(true),
  onStateChange: handleStateChange,
});
```

**Почему два подхода:**
- Iframe работает всегда (даже если API не загрузился)
- API нужен для отслеживания событий
- Graceful degradation: если API недоступен, видео все равно показывается

#### Динамическая смена видео

```javascript
// При изменении videoId:
useEffect(() => {
  setReady(false); // Сброс состояния загрузки
}, [videoId]);

// iframe пересоздается благодаря key={videoId}
```

**Механизм:**
1. `videoId` меняется
2. `ready` сбрасывается → показывается overlay "Loading..."
3. React пересоздает iframe (благодаря `key`)
4. `useEffect` перезапускается → создается новый плеер
5. Когда плеер готов → `ready = true` → overlay скрывается

#### Парсинг YouTube URL

```javascript
export const extractVideoId = (url) => {
  // Поддержка различных форматов:
  // - youtube.com/watch?v=VIDEO_ID
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - Просто VIDEO_ID
};
```

**Гибкость:** Пользователь может вставить любой формат ссылки.

---

## 3. Отслеживание и обработка Side Effects

### 3.1 Управление асинхронными операциями

#### Загрузка YouTube API

```javascript
const setupPlayer = async () => {
  if (!playerFactory) {
    try {
      await loadYouTubeIframeApi();
    } catch (err) {
      // Graceful degradation - показываем iframe даже при ошибке
      console.error(err);
    }
  }
  // ...
};
```

**Обработка ошибок:**
- Try-catch для асинхронных операций
- Приложение продолжает работать даже если API не загрузился
- Показывается iframe без API (ограниченная функциональность)

#### Защита от обновления состояния после размонтирования

```javascript
useEffect(() => {
  let cancelled = false;
  
  const setupPlayer = async () => {
    await loadYouTubeIframeApi();
    
    if (cancelled) return; // ← Проверка после await
    
    // ...
    onReady: () => {
      if (!cancelled) { // ← Проверка перед setState
        setReady(true);
      }
    }
  };
  
  return () => {
    cancelled = true; // ← Cleanup
    playerInstance?.destroy?.();
  };
}, [videoId]);
```

**Проблема, которую решает:** После `await` компонент может быть уже размонтирован. Без проверки `cancelled` будет попытка обновить состояние размонтированного компонента → warning в консоли.

### 3.2 Обработка событий YouTube Player

#### Отслеживание состояний плеера

```javascript
const handleStateChange = (event) => {
  if (cancelled) return; // Защита от выполнения после размонтирования
  
  const currentState = event?.data;
  const current = Math.round(player?.getCurrentTime?.() ?? lastTimeRef.current);
  
  // Обработка PLAYING, PAUSED, BUFFERING
};
```

#### Сложная логика определения seek

**Проблема:** YouTube API не предоставляет отдельное событие `onSeek`. Seek определяется по изменению времени при BUFFERING.

**Решение:**

1. **При BUFFERING с большой разницей времени:**
   ```javascript
   if (timeDiff > 0.5) {
     track({ type: 'seek', from, to: current });
   }
   ```

2. **При клике на timeline (малая разница):**
   ```javascript
   // Сохраняем время перед паузой
   if (currentState === PAUSED) {
     timeBeforePause = lastKnownTime;
   }
   
   // При переходе PAUSE → BUFFERING → PLAYING
   if (lastState === PAUSED && currentState === BUFFERING) {
     checkForSeek(player, timeBeforePause, true); // forceCheck = true
   }
   ```

3. **Проверка с задержкой:**
   ```javascript
   setTimeout(() => {
     const currentTime = player.getCurrentTime();
     if (timeDiff > 0.1) { // Низкий порог для forceCheck
       track({ type: 'seek', ... });
     }
   }, 200); // Даем время API обновиться
   ```

**Почему сложно:**
- Время может обновиться не сразу после клика
- Нужно различать seek от обычной буферизации
- Разные сценарии: простой клик vs перетаскивание

#### Предотвращение дублирования событий

```javascript
let seekTracked = false; // Флаг для отслеживания

// При BUFFERING:
if (timeDiff > 0.5) {
  track({ type: 'seek', ... });
  seekTracked = true; // Помечаем как зафиксированный
}

// При PLAYING:
if (!seekTracked && ...) {
  // Проверяем seek только если еще не был зафиксирован
  checkForSeek(...);
}
```

**Проблема:** Seek может фиксироваться дважды (при BUFFERING и при PLAYING).

### 3.3 Cleanup и управление ресурсами

```javascript
return () => {
  cancelled = true;
  if (seekCheckTimeout) {
    clearTimeout(seekCheckTimeout); // Очистка таймаутов
  }
  playerInstance?.destroy?.(); // Уничтожение плеера
};
```

**Важно:**
- Очистка всех таймаутов
- Уничтожение экземпляра плеера
- Предотвращение утечек памяти

### 3.4 Оптимизация зависимостей useEffect

```javascript
// ❌ Плохо: onTrack в зависимостях
useEffect(() => {
  // ...
}, [videoId, playerFactory, resolvedStates, onTrack]);

// ✅ Хорошо: используем ref
const onTrackRef = useRef(onTrack);
useEffect(() => {
  onTrackRef.current = onTrack;
}, [onTrack]);

useEffect(() => {
  // Используем onTrackRef.current
}, [videoId, playerFactory, resolvedStates]); // Без onTrack
```

**Почему:** `onTrack` может меняться часто (если не мемоизирован), что вызывает лишние пересоздания эффекта.

---

## 4. Компромиссы и улучшения

### 4.1 Компромиссы, которые были сделаны

#### 1. Простая авторизация вместо реальной

**Что сделано:** Toggle для `isLoggedIn`

**Почему:**
- Это демо-проект
- Фокус на логике контроля доступа, а не на реализации auth
- Структура позволяет легко заменить на реальную авторизацию

**Что улучшить:**
- Интеграция с реальным auth provider (Auth0, Firebase, etc.)
- JWT токены
- Refresh tokens
- Роли и права доступа

#### 2. Локальное состояние вместо глобального state management

**Что сделано:** useState в App компоненте

**Почему:**
- Простота для небольшого приложения
- Нет необходимости в Redux/Zustand для текущего масштаба

**Что улучшить:**
- Context API для передачи состояния
- Zustand/Redux для более сложных сценариев
- Сохранение событий в localStorage/IndexedDB
- Синхронизация с backend API

#### 3. Базовое форматирование времени

**Что сделано:** Простое форматирование `349d 8h 23m 45s`

**Что улучшить:**
- Локализация (i18n)
- Относительное время ("2 hours ago")
- Более умное форматирование для больших значений

#### 4. Ограниченная обработка ошибок

**Что сделано:** Try-catch с console.error

**Что улучшить:**
- Error Boundary для React ошибок
- Централизованная система логирования ошибок
- Уведомления пользователю об ошибках
- Retry механизм для загрузки API

#### 5. Нет валидации videoId

**Что сделано:** Принимается любой videoId из URL

**Что улучшить:**
- Валидация формата videoId
- Проверка доступности видео через YouTube API
- Обработка приватных/удаленных видео
- Показ понятных сообщений об ошибках

### 4.2 Улучшения с дополнительным временем

#### Производительность

1. **Виртуализация списка событий:**
   - При большом количестве событий использовать react-window
   - Предотвратить проблемы с производительностью

2. **Debounce для input:**
   ```javascript
   const debouncedUrlChange = useMemo(
     () => debounce(handleUrlChange, 500),
     []
   );
   ```

3. **Мемоизация форматирования:**
   - Кеширование результатов `formatDuration`
   - Использование useMemo для форматированных строк

#### Функциональность

1. **Фильтрация и поиск событий:**
   - Фильтр по типу события
   - Поиск по времени
   - Экспорт событий в CSV/JSON

2. **Статистика:**
   - Графики взаимодействий
   - Время просмотра
   - Популярные моменты видео

3. **Настройки плеера:**
   - Скорость воспроизведения
   - Качество видео
   - Автоплей

#### Архитектура

1. **Разделение на хуки:**
   ```javascript
   // useYouTubePlayer.js
   export const useYouTubePlayer = (videoId, options) => {
     // Вся логика плеера
   };
   
   // useEventTracking.js
   export const useEventTracking = () => {
     // Логика отслеживания событий
   };
   ```

2. **TypeScript:**
   - Типизация всех компонентов
   - Интерфейсы для событий
   - Типы для YouTube API

3. **Storybook:**
   - Документация компонентов
   - Изолированная разработка
   - Визуальное тестирование

#### Тестирование

1. **Больше unit тестов:**
   - Тесты для утилит (formatDuration, extractVideoId)
   - Тесты для YouTubeApiLoader
   - Edge cases

2. **Integration тесты:**
   - Полный flow авторизации
   - Смена видео
   - Обработка ошибок

3. **E2E тесты:**
   - Playwright/Cypress
   - Тестирование реального взаимодействия

---

## 5. Подход к тестированию

### 5.1 Стратегия тестирования

#### Пирамида тестирования

```
        /\
       /E2E\        ← Меньше всего (критические flows)
      /------\
     /Integration\  ← Среднее количество
    /------------\
   /   Unit Tests  \ ← Больше всего (утилиты, логика)
  /----------------\
```

### 5.2 Dependency Injection для тестирования

#### Мокирование YouTube API

```javascript
// В тесте:
const playerFactory = (_el, _videoId, events) => {
  stateChangeHandler = events.onStateChange;
  events.onReady?.(); // Симулируем готовность
  mockPlayer = {
    destroy: vi.fn(),
    getCurrentTime: vi.fn(() => currentTime),
  };
  return mockPlayer;
};

render(<App playerFactory={playerFactory} playerStates={PLAYER_STATES} />);
```

**Преимущества:**
- Полный контроль над поведением плеера
- Нет зависимости от внешнего API
- Быстрые тесты
- Предсказуемое поведение

#### Инжекция состояний

```javascript
render(<App playerStates={PLAYER_STATES} />);
```

**Зачем:** Позволяет тестировать с известными состояниями без зависимости от глобального `window.YT.PlayerState`.

### 5.3 Тестирование компонентов

#### Тест 1: Access Control

```javascript
it('blocks unauthenticated users from seeing the player', () => {
  render(<App />);
  
  expect(screen.getByTestId('auth-state')).toHaveTextContent(/guest/i);
  expect(screen.getByTestId('login-banner')).toBeInTheDocument();
  expect(screen.queryByTestId('player-container')).not.toBeInTheDocument();
});
```

**Что проверяет:**
- Правильное отображение состояния гостя
- Наличие placeholder вместо плеера
- Отсутствие плеера для неавторизованных

#### Тест 2: Event Tracking

```javascript
it('records play, pause, and seek interactions', async () => {
  // Мокирование
  const playerFactory = ...;
  
  render(<App playerFactory={playerFactory} playerStates={PLAYER_STATES} />);
  
  // Симуляция взаимодействий
  fireEvent.click(screen.getByTestId('login-toggle'));
  act(() => stateChangeHandler({ data: PLAYER_STATES.PLAYING, ... }));
  
  // Проверка результатов
  const log = await screen.findByTestId('event-log');
  expect(within(log).getByText('PLAY')).toBeInTheDocument();
  expect(within(log).getByText('PAUSE')).toBeInTheDocument();
  expect(within(log).getByText(/0s → 42s/i)).toBeInTheDocument();
});
```

**Что проверяет:**
- Корректная запись событий
- Правильное форматирование
- Обработка seek событий

### 5.4 Тестирование утилит (потенциал)

#### Пример теста для formatDuration

```javascript
import { formatDuration } from './components/EventLog.jsx';

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(42)).toBe('42s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3665)).toBe('1h 1m 5s');
    expect(formatDuration(30184225)).toBe('349d 8h 23m 45s');
  });
  
  it('handles compact format for same day', () => {
    const from = 30184225; // 349d 8h 31m 15s
    const to = 30190310;   // 349d 11h 14m 18s
    
    expect(formatDuration(from, { compact: true, showDays: false }))
      .toBe('08:31:15');
  });
});
```

**Почему важно:** Утилиты легко тестировать изолированно, они содержат бизнес-логику.

#### Пример теста для extractVideoId

```javascript
import { extractVideoId } from './components/YouTubePlayer.jsx';

describe('extractVideoId', () => {
  it('extracts videoId from various URL formats', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ');
    expect(extractVideoId('dQw4w9WgXcQ'))
      .toBe('dQw4w9WgXcQ');
  });
  
  it('returns null for invalid URLs', () => {
    expect(extractVideoId('not-a-url')).toBeNull();
    expect(extractVideoId('')).toBeNull();
  });
});
```

### 5.5 Ручные кнопки для тестирования

```javascript
<button onClick={() => manualLog('play')}>Log play</button>
<button onClick={() => manualLog('pause')}>Log pause</button>
<button onClick={() => manualLog('seek')}>Log seek +10s</button>
```

**Назначение:**
- Тестирование без YouTube API
- Демонстрация функциональности
- Отладка
- Работа в ограниченных средах (CORS, блокировки)

### 5.6 Что можно улучшить в тестировании

1. **Больше unit тестов:**
   - Все утилиты должны быть покрыты
   - Edge cases для formatDuration, extractVideoId
   - Тесты для YouTubeApiLoader

2. **Тесты для хуков:**
   - Если вынести логику в кастомные хуки
   - Тестирование с @testing-library/react-hooks

3. **Snapshot тесты:**
   - Для UI компонентов
   - Предотвращение случайных изменений

4. **Accessibility тесты:**
   - @testing-library/jest-dom
   - Проверка ARIA атрибутов
   - Keyboard navigation

5. **Performance тесты:**
   - Измерение времени рендера
   - Проверка на memory leaks

---

## Ключевые моменты для интервью

### Что подчеркнуть:

1. **Архитектурные решения:**
   - Dependency Injection для тестируемости
   - Разделение ответственности
   - Модуль-синглтон для API загрузки

2. **Управление side effects:**
   - Защита от обновления размонтированных компонентов
   - Правильная очистка ресурсов
   - Обработка асинхронных операций

3. **Тестируемость:**
   - Все зависимости инжектируются
   - Утилиты экспортируются
   - Мокирование YouTube API

4. **UX:**
   - Graceful degradation
   - Визуальная обратная связь
   - Обработка ошибок

5. **Код качество:**
   - Мемоизация где нужно
   - Оптимизация зависимостей
   - Читаемый и поддерживаемый код

### Вопросы, которые могут задать:

**Q: Почему вы использовали модуль-синглтон вместо обычной функции?**
A: Для предотвращения множественной загрузки API и возможности сброса состояния в тестах. Инкапсуляция состояния в замыкании делает код более предсказуемым.

**Q: Как вы бы масштабировали это приложение?**
A: 
- Вынести логику в кастомные хуки
- Добавить Context API или Zustand для глобального состояния
- Разделить на более мелкие компоненты
- Добавить TypeScript для типобезопасности
- Интегрировать с backend API

**Q: Что бы вы изменили, если бы было больше времени?**
A: См. раздел 4.2 - улучшения с дополнительным временем.

**Q: Как вы тестируете компоненты, которые зависят от внешних API?**
A: Используем Dependency Injection - все зависимости передаются через props. В тестах создаем моки, которые имитируют поведение реального API. Это позволяет тестировать изолированно, быстро и предсказуемо.

---

## Заключение

Проект демонстрирует:
- ✅ Понимание React best practices
- ✅ Управление сложными side effects
- ✅ Тестируемость и переиспользуемость
- ✅ Production-ready подходы
- ✅ Внимание к деталям (защита от memory leaks, правильная очистка)

Готовность к обсуждению компромиссов и улучшений показывает зрелость как разработчика.



