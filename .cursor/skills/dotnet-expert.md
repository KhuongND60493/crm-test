# Cursor Skill: .NET Core Expert
# Target: .NET 6 (LTS) — EF Core 6/7 · Npgsql · Redis · Polly v7
# Focus: Performance · Resource Management · DB Error Handling
# Domain: F&B Enterprise (POS, Microservices, High-throughput APIs)
# Team: Dcorp Vietnam

---

## Skill Activation

Tự động áp dụng khi làm việc với file `.cs`, `.csproj`.
Gọi tường minh:
```
use dotnet-expert skill
apply dotnet-expert for this task
```

> ⚠️ **Target runtime: .NET 6**
> Không dùng: primary constructors, collection expressions `[..]`,
> `FrozenDictionary`, `SearchValues`, `TimeProvider`, `IExceptionHandler`,
> `IHostEnvironment.IsDevelopment()` extension từ .NET 7+,
> `AddResilienceHandler` (Polly v8 — dùng `AddPolicyHandler` thay thế).

---

## 1. Performance Patterns

### 1.1 EF Core Query Optimization

**Rule: Never load what you don't need.**

```csharp
// ══════════════════════════════════════════════════════════
// ANTI-PATTERNS
// ══════════════════════════════════════════════════════════

// ❌ Load full entity chỉ để lấy 1-2 field
var order = await _db.Orders.FindAsync(id);
return order.Status;

// ❌ N+1 — query trong loop
foreach (var order in orders)
    order.Items = await _db.OrderItems
        .Where(i => i.OrderId == order.Id).ToListAsync();

// ❌ Count bằng ToList() — load hết vào RAM rồi mới đếm
var count = (await _db.Orders.Where(o => o.StoreId == sid).ToListAsync()).Count;

// ❌ Include khi chỉ cần scalar của related entity
var orders = await _db.Orders.Include(o => o.Items).ToListAsync();

// ❌ Load entity để update 1 field (dirty tracking toàn bộ object)
var menu = await _db.MenuItems.FindAsync(id);
menu.Price = newPrice;
await _db.SaveChangesAsync();

// ══════════════════════════════════════════════════════════
// CORRECT PATTERNS
// ══════════════════════════════════════════════════════════

// ✅ Project thẳng xuống DTO tại DB — không lấy column thừa
var dto = await _db.Orders
    .AsNoTracking()
    .Where(o => o.Id == id)
    .Select(o => new OrderDto
    {
        Id        = o.Id,
        Status    = o.Status,
        Total     = o.Items.Sum(i => i.Qty * i.Price), // DB-side aggregate
        ItemCount = o.Items.Count()
    })
    .FirstOrDefaultAsync(ct);

// ✅ Batch load diệt N+1
var orderIds = orders.Select(o => o.Id).ToList();
var items = await _db.OrderItems
    .AsNoTracking()
    .Where(i => orderIds.Contains(i.OrderId))
    .ToListAsync(ct);
var byOrder = items.ToLookup(i => i.OrderId);

// ✅ Count tại DB
var count = await _db.Orders
    .Where(o => o.StoreId == sid)
    .CountAsync(ct);

// ✅ Pagination — luôn có bound
var page = await _db.Orders
    .AsNoTracking()
    .Where(o => o.StoreId == sid)
    .OrderByDescending(o => o.CreatedAt)
    .Skip(req.Page * req.PageSize)
    .Take(req.PageSize)
    .Select(o => new OrderSummaryDto
    {
        Id     = o.Id,
        Status = o.Status,
        Total  = o.Total
    })
    .ToListAsync(ct);

// ✅ Update 1-2 field — ExecuteUpdateAsync (EF Core 7+) hoặc attach pattern
// EF Core 6 — attach pattern (không cần load entity):
var entry = new MenuItemPrice { Id = id, Price = newPrice };
_db.MenuItemPrices.Attach(entry);
_db.Entry(entry).Property(x => x.Price).IsModified = true;
await _db.SaveChangesAsync(ct);

// ✅ Compiled query — hot path (>1000 lần/phút), tránh re-compile expression tree
private static readonly Func<AppDbContext, Guid, Task<OrderStatusDto?>>
    _getOrderStatus = EF.CompileAsyncQuery(
        (AppDbContext db, Guid id) =>
            db.Orders
              .AsNoTracking()
              .Where(o => o.Id == id)
              .Select(o => new OrderStatusDto { Id = o.Id, Status = o.Status })
              .FirstOrDefault());

// Usage:
var status = await _getOrderStatus(_db, orderId);
```

### 1.2 Async & Thread Pool

```csharp
// ══════════════════════════════════════════════════════════
// ANTI-PATTERNS
// ══════════════════════════════════════════════════════════

// ❌ Block thread pool — deadlock dưới tải cao
var result = _service.GetAsync().Result;
_service.DoAsync().Wait();
Task.Run(() => _service.ProcessAsync()).Wait();

// ❌ async void — exception không catch được
public async void HandleEvent(object sender, EventArgs e)
{
    await DoSomethingAsync(); // exception sẽ crash process
}

// ══════════════════════════════════════════════════════════
// CORRECT PATTERNS
// ══════════════════════════════════════════════════════════

// ✅ Async all the way
public async Task<Result<OrderDto>> GetOrderAsync(
    Guid id, CancellationToken ct)
{
    var dto = await _db.Orders
        .AsNoTracking()
        .Where(o => o.Id == id)
        .Select(o => new OrderDto { Id = o.Id, Status = o.Status })
        .FirstOrDefaultAsync(ct);

    return dto is null
        ? Result.Failure<OrderDto>(OrderErrors.NotFound(id))
        : Result.Success(dto);
}

// ✅ ValueTask cho hot path — cache hit trả về synchronously
public ValueTask<MenuDto?> GetCachedMenuAsync(Guid storeId)
{
    // TryGetValue không async — ValueTask tránh alloc Task object
    if (_cache.TryGetValue($"menu:{storeId}", out MenuDto? cached))
        return new ValueTask<MenuDto?>(cached);

    return new ValueTask<MenuDto?>(FetchMenuFromDbAsync(storeId));
}
private async Task<MenuDto?> FetchMenuFromDbAsync(Guid storeId) { ... }

// ✅ Parallel I/O cho data độc lập — .NET 6 dùng Task.WhenAll
var storeTask  = _storeRepo.GetAsync(storeId, ct);
var menuTask   = _menuRepo.GetActiveAsync(storeId, ct);
var staffTask  = _staffRepo.GetOnDutyAsync(storeId, ct);

await Task.WhenAll(storeTask, menuTask, staffTask);

var store = storeTask.Result;   // .Result an toàn SAU WhenAll
var menu  = menuTask.Result;
var staff = staffTask.Result;

// ✅ ConfigureAwait(false) trong Infrastructure/library code
// (KHÔNG dùng ở Web layer — ASP.NET Core 6 không cần SynchronizationContext,
//  nhưng nên dùng nhất quán trong lib/infra để tránh deadlock nếu code
//  được reuse sang WinForms/WPF context)
var data = await _db.Orders.ToListAsync(ct).ConfigureAwait(false);
```

### 1.3 Memory Allocation Reduction

```csharp
// ✅ StringBuilder thay + trong loop
var sb = new StringBuilder(capacity: 256);
foreach (var item in items)
    sb.Append(item.Name).Append(", ");
if (sb.Length > 2) sb.Length -= 2; // trim trailing ", "
var result = sb.ToString();

// ✅ Span<T> / ReadOnlySpan<T> — zero allocation parsing (.NET 6 ✅)
public static bool TryParseStoreCode(ReadOnlySpan<char> input, out int storeId)
{
    // "STR-00123" → 123, không tạo substring
    storeId = 0;
    if (input.Length < 5 || !input.StartsWith("STR-", StringComparison.Ordinal))
        return false;
    return int.TryParse(input.Slice(4), out storeId);
}

// ✅ ArrayPool — temporary large buffers
var buffer = ArrayPool<byte>.Shared.Rent(minimumLength: 4096);
try
{
    var bytesWritten = FillBuffer(buffer);
    ProcessBuffer(buffer.AsSpan(0, bytesWritten));
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer, clearArray: false);
}

// ✅ IAsyncEnumerable — stream large datasets (không load hết vào RAM)
// Use case: export 50k orders to CSV
public async IAsyncEnumerable<OrderExportRow> StreamOrdersAsync(
    DateTime from, DateTime to,
    [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
{
    await foreach (var row in _db.Orders
        .AsNoTracking()
        .Where(o => o.CreatedAt >= from && o.CreatedAt <= to)
        .OrderBy(o => o.CreatedAt)
        .Select(o => new OrderExportRow
        {
            Id        = o.Id,
            CreatedAt = o.CreatedAt,
            Total     = o.Total,
            StoreCode = o.Store.Code
        })
        .AsAsyncEnumerable()
        .WithCancellation(ct)
        .ConfigureAwait(false))
    {
        yield return row;
    }
}

// Consumer (controller hoặc background job):
await foreach (var row in _repo.StreamOrdersAsync(from, to, ct))
{
    await writer.WriteLineAsync(row.ToCsvLine());
}

// ✅ Object pool cho expensive objects (JsonSerializerOptions, StringBuilder)
// Đăng ký:
services.AddSingleton<ObjectPool<StringBuilder>>(
    new DefaultObjectPoolProvider().CreateStringBuilderPool());

// Sử dụng:
private readonly ObjectPool<StringBuilder> _sbPool;

public string BuildReport(IEnumerable<Item> items)
{
    var sb = _sbPool.Get();
    try
    {
        foreach (var item in items)
            sb.AppendLine(item.ToString());
        return sb.ToString();
    }
    finally { _sbPool.Return(sb); }
}
```

### 1.4 Caching Strategy

```csharp
// ══════════════════════════════════════════════════════════
// LEVEL 1: IMemoryCache — per-instance, in-process
// Dùng khi: data không thay đổi thường xuyên (<1 lần/phút),
//           read rate cao (>50 lần/phút)
// ══════════════════════════════════════════════════════════

public async Task<StoreConfigDto?> GetStoreConfigAsync(
    Guid storeId, CancellationToken ct)
{
    var key = $"store-config:{storeId}";

    if (_cache.TryGetValue(key, out StoreConfigDto? cached))
        return cached;

    var config = await _db.StoreConfigs
        .AsNoTracking()
        .Where(c => c.StoreId == storeId && c.IsActive)
        .Select(c => new StoreConfigDto
        {
            StoreId  = c.StoreId,
            TimeZone = c.TimeZone,
            Currency = c.Currency
        })
        .FirstOrDefaultAsync(ct);

    if (config is not null)
    {
        var opts = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
            SlidingExpiration               = TimeSpan.FromMinutes(3),
            Priority                        = CacheItemPriority.Normal,
            Size                            = 1   // required nếu dùng SizeLimit
        };
        _cache.Set(key, config, opts);
    }

    return config;
}

// ══════════════════════════════════════════════════════════
// LEVEL 2: IDistributedCache (Redis) — shared across instances
// Dùng khi: multi-instance deployment, session, rate limiting
// ══════════════════════════════════════════════════════════

public async Task<T?> GetOrSetAsync<T>(
    string key,
    Func<CancellationToken, Task<T>> factory,
    TimeSpan ttl,
    CancellationToken ct) where T : class
{
    var bytes = await _redis.GetAsync(key, ct).ConfigureAwait(false);
    if (bytes is not null)
    {
        return JsonSerializer.Deserialize<T>(bytes);
    }

    var value = await factory(ct).ConfigureAwait(false);
    if (value is not null)
    {
        var data = JsonSerializer.SerializeToUtf8Bytes(value);
        await _redis.SetAsync(key, data,
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl
            }, ct).ConfigureAwait(false);
    }
    return value;
}

// ── Cache invalidation on write (trong CommandHandler) ────
await _db.SaveChangesAsync(ct);  // commit first

// Sau đó xóa cache — fire and forget nếu cache miss acceptable
var cacheKey = $"store-config:{command.StoreId}";
await _redis.RemoveAsync(cacheKey, ct);
_memCache.Remove(cacheKey);
```

---

## 2. DB Error Handling

### 2.1 PostgreSQL Error Discrimination

```csharp
// ── Error codes (Npgsql / PostgreSQL) ─────────────────────
internal static class PgErrorCodes
{
    // Integrity constraint
    public const string UniqueViolation       = "23505";
    public const string ForeignKeyViolation   = "23503";
    public const string NotNullViolation      = "23502";
    public const string CheckViolation        = "23514";
    public const string ExclusionViolation    = "23P01";

    // Transaction
    public const string DeadlockDetected      = "40P01";
    public const string SerializationFailure  = "40001";

    // Resources
    public const string TooManyConnections    = "53300";
    public const string DiskFull              = "53100";
    public const string OutOfMemory           = "53200";

    // Query
    public const string QueryCanceled         = "57014";
    public const string LockNotAvailable      = "55P03";
    public const string StatementTimeout      = "57014";
}

// ── Helper discriminators ──────────────────────────────────
internal static class DbExceptionHelper
{
    public static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg
            && pg.SqlState == PgErrorCodes.UniqueViolation;

    public static bool IsForeignKeyViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg
            && pg.SqlState == PgErrorCodes.ForeignKeyViolation;

    public static bool IsDeadlock(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg
            && pg.SqlState == PgErrorCodes.DeadlockDetected;

    public static bool IsSerializationFailure(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg
            && pg.SqlState == PgErrorCodes.SerializationFailure;

    public static string? GetConstraintName(DbUpdateException ex) =>
        (ex.InnerException as PostgresException)?.ConstraintName;
}

// ── Repository base pattern ────────────────────────────────
public abstract class RepositoryBase
{
    private readonly ILogger _logger;
    protected RepositoryBase(ILogger logger) => _logger = logger;

    protected async Task<Result> ExecuteWriteAsync(
        Func<Task> operation,
        string context,
        CancellationToken ct)
    {
        try
        {
            await operation().ConfigureAwait(false);
            return Result.Success();
        }
        catch (OperationCanceledException)
        {
            // Propagate — request was cancelled, not a bug
            throw;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex,
                "Concurrency conflict [{Context}]", context);
            return Result.Failure(DbErrors.ConcurrencyConflict);
        }
        catch (DbUpdateException ex) when (DbExceptionHelper.IsUniqueViolation(ex))
        {
            _logger.LogWarning(ex,
                "Unique constraint violated [{Context}] constraint={Constraint}",
                context, DbExceptionHelper.GetConstraintName(ex));
            return Result.Failure(DbErrors.DuplicateKey);
        }
        catch (DbUpdateException ex) when (DbExceptionHelper.IsForeignKeyViolation(ex))
        {
            _logger.LogWarning(ex,
                "FK violation [{Context}] constraint={Constraint}",
                context, DbExceptionHelper.GetConstraintName(ex));
            return Result.Failure(DbErrors.ForeignKeyConflict);
        }
        catch (DbUpdateException ex) when (DbExceptionHelper.IsDeadlock(ex))
        {
            _logger.LogWarning(ex,
                "Deadlock detected [{Context}]", context);
            return Result.Failure(DbErrors.Deadlock);
        }
        catch (DbUpdateException ex) when (DbExceptionHelper.IsSerializationFailure(ex))
        {
            _logger.LogWarning(ex,
                "Serialization failure [{Context}] — retry eligible", context);
            return Result.Failure(DbErrors.SerializationFailure);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unexpected DB error [{Context}]", context);
            return Result.Failure(DbErrors.UnexpectedError);
        }
    }
}
```

### 2.2 Retry với Polly v7 (.NET 6)

```csharp
// ── Package: Polly v7 + Microsoft.Extensions.Http.Polly ───
// KHÔNG dùng Polly v8 AddResiliencePipeline (yêu cầu .NET 7+)

// ── DI registration ────────────────────────────────────────
public static class ResiliencePolicies
{
    // DB write — retry deadlock / serialization failure
    public static IAsyncPolicy GetDbRetryPolicy(ILogger logger) =>
        Policy
            .Handle<DbUpdateException>(ex =>
                DbExceptionHelper.IsDeadlock(ex) ||
                DbExceptionHelper.IsSerializationFailure(ex))
            .Or<PostgresException>(ex =>
                ex.SqlState == PgErrorCodes.TooManyConnections)
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: attempt =>
                    TimeSpan.FromMilliseconds(Math.Pow(2, attempt) * 100)  // 200, 400, 800ms
                    + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 100)), // jitter
                onRetry: (ex, timespan, attempt, _) =>
                    logger.LogWarning(ex,
                        "DB retry {Attempt}/3 after {Delay}ms",
                        attempt, timespan.TotalMilliseconds));

    // HTTP external service — retry + circuit breaker
    public static IAsyncPolicy<HttpResponseMessage> GetHttpRetryPolicy(ILogger logger) =>
        Policy<HttpResponseMessage>
            .Handle<HttpRequestException>()
            .OrResult(r => r.StatusCode is
                HttpStatusCode.ServiceUnavailable or
                HttpStatusCode.TooManyRequests or
                HttpStatusCode.GatewayTimeout)
            .WaitAndRetryAsync(
                retryCount: 2,
                sleepDurationProvider: attempt =>
                    TimeSpan.FromSeconds(Math.Pow(2, attempt))
                    + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 300)),
                onRetry: (outcome, timespan, attempt, _) =>
                    logger.LogWarning(
                        "HTTP retry {Attempt}/2 after {Delay}ms. Status: {Status}",
                        attempt, timespan.TotalMilliseconds,
                        outcome.Result?.StatusCode));

    public static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy(ILogger logger) =>
        Policy<HttpResponseMessage>
            .Handle<HttpRequestException>()
            .OrResult(r => !r.IsSuccessStatusCode)
            .CircuitBreakerAsync(
                handledEventsAllowedBeforeBreaking: 5,
                durationOfBreak: TimeSpan.FromSeconds(20),
                onBreak: (_, duration) =>
                    logger.LogError(
                        "Circuit OPEN. Break duration: {Duration}s",
                        duration.TotalSeconds),
                onReset: () =>
                    logger.LogInformation("Circuit CLOSED — service recovered"));
}

// ── Registration in DI (Startup.cs hoặc Program.cs) ───────
// Cho typed HttpClient:
services
    .AddHttpClient<IPosApiClient, PosApiClient>(client =>
    {
        client.BaseAddress = new Uri(configuration["PosApi:BaseUrl"]!);
        client.Timeout     = TimeSpan.FromSeconds(10);
    })
    .AddPolicyHandler(
        ResiliencePolicies.GetHttpRetryPolicy(
            LoggerFactory.Create(b => b.AddConsole())
                         .CreateLogger("PosApiClient")))
    .AddPolicyHandler(
        ResiliencePolicies.GetCircuitBreakerPolicy(
            LoggerFactory.Create(b => b.AddConsole())
                         .CreateLogger("PosApiClient")));

// Cho DB repository — inject và wrap:
public class OrderRepository : RepositoryBase, IOrderRepository
{
    private readonly AppDbContext _db;
    private readonly IAsyncPolicy _dbRetry;

    public OrderRepository(
        AppDbContext db,
        ILogger<OrderRepository> logger) : base(logger)
    {
        _db      = db;
        _dbRetry = ResiliencePolicies.GetDbRetryPolicy(logger);
    }

    public async Task<Result> SaveAsync(Order order, CancellationToken ct)
    {
        return await _dbRetry.ExecuteAsync(token =>
            ExecuteWriteAsync(async () =>
            {
                _db.Orders.Add(order);
                await _db.SaveChangesAsync(token);
            }, $"SaveOrder:{order.Id}", token), ct);
    }
}
```

### 2.3 Transaction Management

```csharp
// ── Pattern: short transaction, business logic OUTSIDE ─────
public async Task<Result<Guid>> CreateOrderAsync(
    CreateOrderCommand cmd, CancellationToken ct)
{
    // 1. Validate & build domain object ngoài transaction
    var buildResult = Order.Create(cmd.StoreId, cmd.Items, cmd.Note);
    if (buildResult.IsFailure)
        return buildResult.Map<Guid>();

    var order = buildResult.Value;

    // 2. Gọi external service ngoài transaction (nếu cần check stock)
    var stockOk = await _inventoryService.CheckStockAsync(cmd.Items, ct);
    if (!stockOk)
        return Result.Failure<Guid>(OrderErrors.InsufficientStock);

    // 3. Transaction chỉ bao quanh DB write — càng ngắn càng tốt
    await using var tx = await _db.Database
        .BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, ct)
        .ConfigureAwait(false);
    try
    {
        _db.Orders.Add(order);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        await tx.CommitAsync(ct).ConfigureAwait(false);
    }
    catch
    {
        await tx.RollbackAsync(ct).ConfigureAwait(false);
        throw;
    }

    // 4. Side effects SAU commit — không rollback nếu đây fail
    await _eventBus.PublishAsync(new OrderCreatedEvent(order.Id), ct);

    return Result.Success(order.Id);
}

// ── Optimistic concurrency — dùng RowVersion ───────────────
// Entity config (IEntityTypeConfiguration<T>):
builder.Property(o => o.RowVersion)
    .IsRowVersion()         // auto-increment by DB on every UPDATE
    .IsConcurrencyToken();  // EF throws DbUpdateConcurrencyException on conflict

// Handler — retry on concurrency conflict:
public async Task<Result> UpdateMenuPriceAsync(
    UpdateMenuPriceCommand cmd, CancellationToken ct)
{
    for (var attempt = 0; attempt < 3; attempt++)
    {
        var item = await _db.MenuItems.FindAsync(new object[] { cmd.ItemId }, ct);
        if (item is null)
            return Result.Failure(MenuErrors.NotFound(cmd.ItemId));

        item.UpdatePrice(cmd.NewPrice);

        try
        {
            await _db.SaveChangesAsync(ct);
            return Result.Success();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (attempt == 2)
                return Result.Failure(DbErrors.ConcurrencyConflict);

            // Reload từ DB trước khi retry
            await _db.Entry(item).ReloadAsync(ct);
            _logger.LogWarning(
                "Concurrency conflict on MenuItem {Id}, attempt {Attempt}",
                cmd.ItemId, attempt + 1);
        }
    }

    return Result.Failure(DbErrors.ConcurrencyConflict);
}
```

---

## 3. Resource Management

### 3.1 Connection Pool (Npgsql + EF Core 6)

```json
// appsettings.json — Npgsql connection string parameters
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=mydb;Username=app;Password=secret;
                Maximum Pool Size=50;Minimum Pool Size=5;
                Connection Idle Lifetime=300;
                Connection Pruning Interval=10;
                Keepalive=30;
                Command Timeout=30;
                Application Name=MyService"
  }
}
```

```csharp
// Program.cs — DbContextPool tái sử dụng instance, giảm GC pressure
builder.Services.AddDbContextPool<AppDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsqlOptions =>
        {
            npgsqlOptions.CommandTimeout(30);
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null);
        });

    // Dev only
    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();
        options.EnableDetailedErrors();
        options.LogTo(Console.WriteLine,
            new[] { DbLoggerCategory.Database.Command.Name },
            Microsoft.Extensions.Logging.LogLevel.Information);
    }
}, poolSize: 128);
```

### 3.2 HttpClient Lifecycle

```csharp
// ❌ Tuyệt đối không tạo HttpClient trực tiếp trong service
public class BadService
{
    public async Task<string> GetDataAsync()
    {
        using var client = new HttpClient();  // socket exhaustion!
        return await client.GetStringAsync("http://api/data");
    }
}

// ✅ Typed HttpClient — IHttpClientFactory quản lý lifetime
public class PosApiClient : IPosApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<PosApiClient> _logger;

    // Constructor injection — KHÔNG dùng primary constructor (.NET 6)
    public PosApiClient(HttpClient http, ILogger<PosApiClient> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public async Task<OrderStatusDto?> GetOrderStatusAsync(
        string orderId, CancellationToken ct)
    {
        try
        {
            var response = await _http
                .GetAsync($"/api/orders/{orderId}/status", ct)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "POS API returned {Status} for order {OrderId}",
                    response.StatusCode, orderId);
                return null;
            }

            return await response.Content
                .ReadFromJsonAsync<OrderStatusDto>(cancellationToken: ct)
                .ConfigureAwait(false);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex,
                "Failed to get order status from POS for {OrderId}", orderId);
            return null;
        }
    }
}

// Registration in Program.cs / Startup.cs:
services
    .AddHttpClient<IPosApiClient, PosApiClient>(client =>
    {
        client.BaseAddress = new Uri(configuration["PosApi:BaseUrl"]!);
        client.DefaultRequestHeaders.Add("X-API-Key",
            configuration["PosApi:ApiKey"]);
        client.Timeout = TimeSpan.FromSeconds(10);
    })
    .AddPolicyHandler(ResiliencePolicies.GetHttpRetryPolicy(logger))
    .AddPolicyHandler(ResiliencePolicies.GetCircuitBreakerPolicy(logger));
```

### 3.3 Background Worker (.NET 6)

```csharp
// ✅ BackgroundService với proper lifecycle
public sealed class MetricsPushWorker : BackgroundService
{
    // KHÔNG dùng IRepository trực tiếp (Scoped trong Singleton → error)
    // Phải dùng IServiceScopeFactory
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IOptionsMonitor<MetricsOptions> _opts;
    private readonly ILogger<MetricsPushWorker> _logger;

    public MetricsPushWorker(
        IServiceScopeFactory scopeFactory,
        IOptionsMonitor<MetricsOptions> opts,
        ILogger<MetricsPushWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _opts         = opts;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "{Worker} started. Interval: {Interval}ms",
            nameof(MetricsPushWorker),
            _opts.CurrentValue.IntervalMs);

        while (!stoppingToken.IsCancellationRequested)
        {
            // Đọc config mỗi vòng — IOptionsMonitor reflects live changes
            var intervalMs = _opts.CurrentValue.IntervalMs;

            try
            {
                // New scope per batch — Scoped services sống trong scope này
                await using var scope = _scopeFactory.CreateAsyncScope();
                var pusher = scope.ServiceProvider
                    .GetRequiredService<IMetricsPusher>();

                await pusher.PushBatchAsync(stoppingToken)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break; // Clean shutdown
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "{Worker} batch failed — retrying in {Delay}ms",
                    nameof(MetricsPushWorker),
                    Math.Min(intervalMs * 2, 30_000));

                // Không rethrow — giữ worker alive
                await Task.Delay(
                    Math.Min(intervalMs * 2, 30_000),
                    stoppingToken).ConfigureAwait(false);
                continue;
            }

            await Task.Delay(intervalMs, stoppingToken).ConfigureAwait(false);
        }

        _logger.LogInformation("{Worker} stopped", nameof(MetricsPushWorker));
    }
}

// Registration:
services.AddHostedService<MetricsPushWorker>();
```

---

## 4. Observability (.NET 6)

### 4.1 Structured Logging

```csharp
// ✅ Structured properties — KHÔNG dùng string interpolation
_logger.LogInformation(
    "Order {OrderId} created for Store {StoreId} with {ItemCount} items. Total: {Total:C}",
    order.Id, order.StoreId, order.Items.Count, order.Total);

// ❌ Interpolation — phá hỏng structured logging
_logger.LogInformation($"Order {order.Id} created"); // BAD

// ✅ LoggerMessage.Define — zero-alloc, dùng cho hot paths (>100/s)
private static readonly Action<ILogger, Guid, Guid, Exception?> _logOrderCreated =
    LoggerMessage.Define<Guid, Guid>(
        LogLevel.Information,
        new EventId(1001, nameof(OrderCreated)),
        "Order {OrderId} created for Store {StoreId}");

// Trong class sử dụng:
_logOrderCreated(_logger, order.Id, order.StoreId, null);

// ✅ Log levels — dùng đúng
// Trace/Debug  → diagnostic, OFF trong production
// Information  → lifecycle events: startup, shutdown, job tick, request in/out
// Warning      → recoverable: retry, cache miss, degraded mode, slow query
// Error        → cần attention nhưng service vẫn chạy: DB error, external fail
// Critical     → service-threatening: startup fail, data corruption

// ✅ KHÔNG log sensitive data
// ❌ _logger.LogDebug("User logged in: {Password}", user.Password);
// ❌ _logger.LogInfo("Connecting with: {ConnectionString}", connStr);
// ❌ _logger.LogInfo("JWT token: {Token}", jwtToken);
```

### 4.2 OpenTelemetry (.NET 6)

```csharp
// Packages: OpenTelemetry.Extensions.Hosting
//           OpenTelemetry.Instrumentation.AspNetCore
//           OpenTelemetry.Instrumentation.EntityFrameworkCore
//           OpenTelemetry.Exporter.OpenTelemetryProtocol

// ── Custom telemetry definitions ──────────────────────────
public static class AppTelemetry
{
    public static readonly string ServiceName    = "Dcorp.PosService";
    public static readonly string ServiceVersion = "1.0.0";

    public static readonly ActivitySource Source =
        new ActivitySource(ServiceName, ServiceVersion);

    public static readonly Meter Meter =
        new Meter(ServiceName, ServiceVersion);

    // Counters
    public static readonly Counter<long> OrdersCreated =
        Meter.CreateCounter<long>("orders.created.total",
            unit: "orders",
            description: "Total orders created");

    // Histograms
    public static readonly Histogram<double> OrderProcessingMs =
        Meter.CreateHistogram<double>("orders.processing.duration",
            unit: "ms",
            description: "Order processing duration in ms");

    // Gauge — dùng ObservableGauge cho giá trị poll-based
    public static readonly ObservableGauge<int> QueueDepth =
        Meter.CreateObservableGauge<int>("orders.queue.depth",
            observeValue: () => OrderQueue.Current.Count,
            unit: "orders",
            description: "Current order queue depth");
}

// ── Registration in Program.cs ─────────────────────────────
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .SetResourceBuilder(ResourceBuilder.CreateDefault()
                .AddService(AppTelemetry.ServiceName, AppTelemetry.ServiceVersion))
            .AddSource(AppTelemetry.ServiceName)
            .AddAspNetCoreInstrumentation(opts =>
            {
                opts.RecordException = true;
                opts.Filter = ctx =>
                    !ctx.Request.Path.StartsWithSegments("/health");
            })
            .AddEntityFrameworkCoreInstrumentation(opts =>
            {
                opts.SetDbStatementForText = builder.Environment.IsDevelopment();
            })
            .AddNpgsql()
            .AddOtlpExporter(opts =>
            {
                opts.Endpoint = new Uri(builder.Configuration["Otlp:Endpoint"]!);
            });
    })
    .WithMetrics(metrics =>
    {
        metrics
            .SetResourceBuilder(ResourceBuilder.CreateDefault()
                .AddService(AppTelemetry.ServiceName, AppTelemetry.ServiceVersion))
            .AddMeter(AppTelemetry.ServiceName)
            .AddAspNetCoreInstrumentation()
            .AddRuntimeInstrumentation()
            .AddOtlpExporter();
    });

// ── Usage in handler ───────────────────────────────────────
public async Task<Result<Guid>> Handle(
    CreateOrderCommand cmd, CancellationToken ct)
{
    using var activity = AppTelemetry.Source.StartActivity("Order.Create");
    activity?.SetTag("store.id", cmd.StoreId.ToString());
    activity?.SetTag("order.item_count", cmd.Items.Count);

    var sw = Stopwatch.StartNew();
    try
    {
        var result = await _repo.SaveAsync(order, ct);

        activity?.SetTag("result", result.IsSuccess ? "success" : "failure");
        if (result.IsFailure)
            activity?.SetStatus(ActivityStatusCode.Error, result.Error.Message);

        if (result.IsSuccess)
            AppTelemetry.OrdersCreated.Add(1,
                new KeyValuePair<string, object?>("store.id", cmd.StoreId));

        return result.Map(_ => order.Id);
    }
    finally
    {
        AppTelemetry.OrderProcessingMs.Record(sw.ElapsedMilliseconds,
            new KeyValuePair<string, object?>("store.id", cmd.StoreId));
    }
}
```

### 4.3 Health Checks (.NET 6)

```csharp
// Packages: AspNetCore.HealthChecks.Npgsql
//           AspNetCore.HealthChecks.Redis
//           AspNetCore.HealthChecks.Uris

builder.Services
    .AddHealthChecks()
    .AddNpgsql(
        connectionString: builder.Configuration.GetConnectionString("Default")!,
        name: "postgres",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "db", "critical" })
    .AddRedis(
        redisConnectionString: builder.Configuration["Redis:ConnectionString"]!,
        name: "redis",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "cache" })
    .AddUrlGroup(
        uri: new Uri(builder.Configuration["PosApi:BaseUrl"] + "/health"),
        name: "pos-api",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "external" })
    .AddCheck<MetricsWorkerHealthCheck>(
        name: "metrics-worker",
        tags: new[] { "worker" });

// Expose
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = hc => hc.Tags.Contains("critical")
});
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // chỉ cần process alive
});
app.MapHealthChecks("/health/all", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
```

---

## 5. .NET 6 — Đặc thù & Gotchas

```csharp
// ── Minimal API (Program.cs top-level) ────────────────────
// .NET 6 dùng minimal hosting model
var builder = WebApplication.CreateBuilder(args);
// Không có Startup.cs — tất cả trong Program.cs

// ── Global using .NET 6 ───────────────────────────────────
// File GlobalUsings.cs (tự tạo nếu chưa có):
global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Threading;
global using System.Threading.Tasks;
global using Microsoft.Extensions.Logging;

// ── Nullable reference types ──────────────────────────────
// .NET 6 projects bật nullable theo mặc định — luôn annotate
public record OrderDto
{
    public Guid Id        { get; init; }
    public string? Note   { get; init; }  // nullable — có thể null
    public string Name    { get; init; } = string.Empty; // non-nullable — không được null
}

// ── ĐỪNG dùng trong .NET 6 ────────────────────────────────
// ❌ Primary constructors   → chỉ C# 12 (.NET 8)
// ❌ Collection expressions [..]  → chỉ C# 12 (.NET 8)
// ❌ FrozenDictionary       → chỉ .NET 8
// ❌ SearchValues           → chỉ .NET 8
// ❌ TimeProvider           → chỉ .NET 8
// ❌ IExceptionHandler      → chỉ .NET 8
// ❌ AddResilienceHandler   → Polly v8, chỉ .NET 7+
// ❌ Task.WhenAll tuple     → chỉ C# 12 (dùng Task.WhenAll + .Result)
// ❌ [EnumeratorCancellation] — ✅ OK trong .NET 6

// ── DÙNG được trong .NET 6 ────────────────────────────────
// ✅ record types               → C# 9 (.NET 5+)
// ✅ init-only properties       → C# 9 (.NET 5+)
// ✅ pattern matching switch    → C# 8+ ✅
// ✅ IAsyncEnumerable<T>        → .NET Core 3+ ✅
// ✅ Span<T>, Memory<T>         → .NET Core 2.1+ ✅
// ✅ ArrayPool<T>               → .NET Core 1+ ✅
// ✅ ValueTask<T>               → .NET Core 1+ ✅
// ✅ ConfigureAwait(false)      → always ✅
// ✅ Polly v7 WaitAndRetryAsync → ✅
// ✅ CreateAsyncScope()         → .NET 6 ✅
// ✅ IOptionsMonitor<T>         → .NET Core 2+ ✅
// ✅ DbContextPool              → EF Core 2.1+ ✅
// ✅ EF.CompileAsyncQuery       → EF Core 6 ✅

// ── Global exception handler trong .NET 6 ─────────────────
// Không có IExceptionHandler — dùng middleware:
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // Client disconnected — không log as error
            ctx.Response.StatusCode = 499; // nginx convention
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation failed for {Path}", ctx.Request.Path);
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            await ctx.Response.WriteAsJsonAsync(
                new ProblemDetails { Title = "Validation failed", Detail = ex.Message });
        }
        catch (NotFoundException ex)
        {
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            await ctx.Response.WriteAsJsonAsync(
                new ProblemDetails { Title = "Not found", Detail = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unhandled exception for {Method} {Path}",
                ctx.Request.Method, ctx.Request.Path);
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await ctx.Response.WriteAsJsonAsync(
                new ProblemDetails { Title = "Internal server error" });
        }
    }
}

// Register (trước UseRouting):
app.UseMiddleware<GlobalExceptionMiddleware>();
```

---

## 6. DI Lifetime Quick Reference

```
Singleton  — stateless, app-scoped: IMemoryCache, HttpClientFactory wrappers,
             IOptions<T> (static config), ActivitySource, Meter,
             IHostedService registrations
             
Scoped     — per-HTTP-request: DbContext, IUnitOfWork, ICurrentUser,
             IOptionsSnapshot<T> (config có thể thay đổi)
             
Transient  — per-resolve, lightweight: Validators, mappers, calculators

⚠️  Không inject Scoped vào Singleton → runtime error hoặc stale data
⚠️  IHttpClientFactory là Singleton — dùng typed HttpClient,
    KHÔNG đăng ký typed HttpClient trực tiếp là Singleton
⚠️  IOptionsMonitor<T> là Singleton — dùng để watch config changes
⚠️  Trong BackgroundService (Singleton) — dùng IServiceScopeFactory
    để tạo Scope per-batch, không inject Scoped service trực tiếp
```

---

*ROMIO Cursor Skill — dotnet-expert*
*Target: .NET 6 LTS · EF Core 6 · Polly v7 · Npgsql 6*
*Optimized for: Dcorp Vietnam · PostgreSQL · Redis · F&B Enterprise*
