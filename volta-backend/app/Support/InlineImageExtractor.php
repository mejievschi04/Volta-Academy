<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;

/**
 * Înlocuiește imaginile base64 din text (HTML sau JSON) cu fișiere comprimate din
 * storage/app/public/content/images. Aceeași imagine devine un singur fișier (nume = sha1).
 * Folosit la salvarea conținutului (ExtractsInlineImages) și de `volta:extract-inline-images`.
 */
class InlineImageExtractor
{
    // În JSON slash-urile pot fi scăpate (`data:image\/png`), iar base64 poate conține `\/`.
    public const PATTERN = '#data:image(\\\\?/)(png|jpe?g|gif|webp);base64,((?:[A-Za-z0-9+/=]|\\\\/)+)#i';

    /** @var array<string, string> sha1 → URL */
    private array $stored = [];

    public int $images = 0;

    public function __construct(private bool $dryRun = false) {}

    public static function contains(?string $value): bool
    {
        return $value !== null && str_contains($value, 'data:image');
    }

    public function replace(string $value): string
    {
        if (! self::contains($value)) {
            return $value;
        }

        return preg_replace_callback(self::PATTERN, function (array $m) {
            $escaped = $m[1] === '\\/';
            $bytes = base64_decode(str_replace('\\/', '/', $m[3]), true);
            if ($bytes === false || $bytes === '') {
                return $m[0];
            }
            $this->images++;
            $url = $this->stored[sha1($bytes)] ??= $this->dryRun
                ? '/storage/content/images/dry-run'
                : $this->store($bytes, strtolower($m[2]));

            return $escaped ? str_replace('/', '\\/', $url) : $url;
        }, $value) ?? $value;
    }

    public function uniqueFiles(): int
    {
        return count($this->stored);
    }

    private function store(string $bytes, string $extension): string
    {
        $hash = sha1($bytes);
        $tmp = tempnam(sys_get_temp_dir(), 'inline');
        file_put_contents($tmp, $bytes);
        try {
            $mime = $extension === 'jpg' ? 'image/jpeg' : 'image/'.$extension;
            $file = ImageOptimizer::optimize(new UploadedFile($tmp, "{$hash}.{$extension}", $mime, null, true));
            $path = $file->storeAs('content/images', $hash.'.'.$file->getClientOriginalExtension(), 'public');
        } finally {
            @unlink($tmp);
        }

        return '/storage/'.$path;
    }
}
