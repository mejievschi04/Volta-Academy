<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class CertificateSettingsController extends Controller
{
    /**
     * Get certificate settings
     */
    public function index()
    {
        $settings = Setting::where('key', 'like', 'certificate_%')->get()->mapWithKeys(function ($setting) {
            return [str_replace('certificate_', '', $setting->key) => $this->castValue($setting->value, $setting->type)];
        });

        // Return default settings if none exist
        if ($settings->isEmpty()) {
            return response()->json([
                'template' => 'modern',
                'primary_color' => '#38bdf8',
                'secondary_color' => '#0ea5e9',
                'accent_color' => '#ffd700',
                'background_color' => '#ffffff',
                'border_color' => '#38bdf8',
                'border_style' => 'solid',
                'border_width' => '3px',
                'font_family' => 'Georgia, serif',
                'logo_url' => '',
                'organization_name' => 'Volta Academy',
                'organization_subtitle' => 'Platformă de învățare online',
                'custom_text' => '',
            ]);
        }

        return response()->json($settings);
    }

    /**
     * Update certificate settings
     */
    public function update(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'template' => 'nullable|in:classic,modern,premium',
            'primary_color' => 'nullable|string|max:7',
            'secondary_color' => 'nullable|string|max:7',
            'accent_color' => 'nullable|string|max:7',
            'background_color' => 'nullable|string|max:7',
            'border_color' => 'nullable|string|max:7',
            'border_style' => 'nullable|in:solid,dashed,double,dotted',
            'border_width' => 'nullable|string|max:10',
            'font_family' => 'nullable|string|max:255',
            'logo_url' => 'nullable|string|max:500',
            'organization_name' => 'nullable|string|max:255',
            'organization_subtitle' => 'nullable|string|max:255',
            'custom_text' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Date invalide',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->all() as $key => $value) {
            $settingKey = 'certificate_' . $key;
            $setting = Setting::firstOrNew(['key' => $settingKey]);
            $setting->value = is_bool($value) ? ($value ? '1' : '0') : (string)$value;
            $setting->type = is_bool($value) ? 'boolean' : 'string';
            $setting->description = 'Certificate setting: ' . $key;
            $setting->save();
        }

        return response()->json([
            'message' => 'Setările certificate au fost actualizate cu succes',
        ]);
    }

    /**
     * Upload certificate logo
     */
    public function uploadLogo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'logo' => 'required|image|mimes:jpeg,png,jpg,gif,webp,svg|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Fișier invalid',
                'errors' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('logo');
        $path = $file->store('certificates/logos', 'public');
        $url = Storage::url($path);

        // Save logo URL to settings
        $setting = Setting::firstOrNew(['key' => 'certificate_logo_url']);
        $setting->value = $url;
        $setting->type = 'string';
        $setting->description = 'Certificate logo URL';
        $setting->save();

        return response()->json([
            'message' => 'Logo-ul a fost încărcat cu succes',
            'url' => $url,
        ]);
    }

    /**
     * Cast setting value based on type
     */
    private function castValue($value, $type)
    {
        switch ($type) {
            case 'boolean':
                return (bool)$value;
            case 'integer':
                return (int)$value;
            case 'float':
                return (float)$value;
            case 'array':
            case 'json':
                return json_decode($value, true);
            default:
                return $value;
        }
    }
}
