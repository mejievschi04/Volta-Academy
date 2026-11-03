<?php

namespace Tests\Unit;

use App\Support\QuestionImageUrl;
use PHPUnit\Framework\TestCase;

class QuestionImageUrlTest extends TestCase
{
    public function test_keeps_uploaded_storage_files(): void
    {
        $this->assertSame('/storage/content/images/a.webp', QuestionImageUrl::sanitize(' /storage/content/images/a.webp '));
    }

    public function test_keeps_old_http_links(): void
    {
        $this->assertSame('https://example.com/a.jpg', QuestionImageUrl::sanitize('https://example.com/a.jpg'));
    }

    public function test_drops_anything_else(): void
    {
        $this->assertSame('', QuestionImageUrl::sanitize('javascript:alert(1)'));
        $this->assertSame('', QuestionImageUrl::sanitize('data:image/png;base64,AAAA'));
        $this->assertSame('', QuestionImageUrl::sanitize('/storage/../.env'));
        $this->assertSame('', QuestionImageUrl::sanitize('/etc/passwd'));
        $this->assertSame('', QuestionImageUrl::sanitize(null));
    }
}
