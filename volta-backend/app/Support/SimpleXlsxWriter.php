<?php

namespace App\Support;

use RuntimeException;
use ZipArchive;

/**
 * Generator .xlsx minimal cu celule colorate (o singură foaie), fără dependențe:
 * SheetJS din frontend nu scrie stiluri, iar rapoartele de prezență au nevoie de celule verzi.
 *
 * Stilurile sunt fixe (vezi STYLE_*); celulele se dau ca [valoare, stil].
 */
class SimpleXlsxWriter
{
    public const STYLE_DEFAULT = 0;
    public const STYLE_TITLE = 1;
    public const STYLE_HEADER = 2;
    public const STYLE_CELL = 3;
    public const STYLE_GROUP = 4;
    public const STYLE_MARKED = 5;
    public const STYLE_TOTAL = 6;
    public const STYLE_NOTE = 7;

    /** @var array<int, array<int, array{0: mixed, 1: int}>> rând (0-based) => coloană (0-based) => [valoare, stil] */
    private array $cells = [];

    /** @var list<string> ex. "A4:A10" */
    private array $merges = [];

    /** @var array<int, float> */
    private array $columnWidths = [];

    /** @var array<int, float> */
    private array $rowHeights = [];

    private ?string $freezeAt = null;

    public function __construct(private string $sheetName = 'Raport')
    {
        $this->sheetName = mb_substr(preg_replace('/[\\\\\/*?:\[\]]/u', ' ', $sheetName) ?: 'Raport', 0, 31);
    }

    public function set(int $row, int $col, mixed $value, int $style = self::STYLE_DEFAULT): self
    {
        $this->cells[$row][$col] = [$value, $style];

        return $this;
    }

    public function merge(int $row1, int $col1, int $row2, int $col2): self
    {
        if ($row1 !== $row2 || $col1 !== $col2) {
            $this->merges[] = self::ref($row1, $col1).':'.self::ref($row2, $col2);
        }

        return $this;
    }

    public function columnWidth(int $col, float $width): self
    {
        $this->columnWidths[$col] = $width;

        return $this;
    }

    public function rowHeight(int $row, float $height): self
    {
        $this->rowHeights[$row] = $height;

        return $this;
    }

    /** Îngheață rândurile de deasupra și coloanele din stânga celulei date. */
    public function freeze(int $row, int $col): self
    {
        $this->freezeAt = self::ref($row, $col);

        return $this;
    }

    public function save(string $path): void
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Nu s-a putut crea fișierul Excel.');
        }

        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            .'</Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="'.self::xml($this->sheetName).'" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>');
        $zip->addFromString('xl/styles.xml', $this->stylesXml());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->sheetXml());
        $zip->close();
    }

    private function sheetXml(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

        if ($this->freezeAt) {
            [$row, $col] = self::parseRef($this->freezeAt);
            $pane = '<pane'
                .($col > 0 ? ' xSplit="'.$col.'"' : '')
                .($row > 0 ? ' ySplit="'.$row.'"' : '')
                .' topLeftCell="'.$this->freezeAt.'" activePane="bottomRight" state="frozen"/>';
            $xml .= '<sheetViews><sheetView workbookViewId="0">'.$pane.'</sheetView></sheetViews>';
        }

        if ($this->columnWidths) {
            ksort($this->columnWidths);
            $xml .= '<cols>';
            foreach ($this->columnWidths as $col => $width) {
                $n = $col + 1;
                $xml .= '<col min="'.$n.'" max="'.$n.'" width="'.$width.'" customWidth="1"/>';
            }
            $xml .= '</cols>';
        }

        $xml .= '<sheetData>';
        $rows = array_keys($this->cells + $this->rowHeights);
        sort($rows);
        foreach ($rows as $row) {
            $height = isset($this->rowHeights[$row]) ? ' ht="'.$this->rowHeights[$row].'" customHeight="1"' : '';
            $xml .= '<row r="'.($row + 1).'"'.$height.'>';
            $cols = $this->cells[$row] ?? [];
            ksort($cols);
            foreach ($cols as $col => [$value, $style]) {
                $ref = self::ref($row, $col);
                $s = $style ? ' s="'.$style.'"' : '';
                if ($value === null || $value === '') {
                    $xml .= '<c r="'.$ref.'"'.$s.'/>';
                } elseif (is_int($value) || is_float($value)) {
                    $xml .= '<c r="'.$ref.'"'.$s.'><v>'.$value.'</v></c>';
                } else {
                    $xml .= '<c r="'.$ref.'"'.$s.' t="inlineStr"><is><t xml:space="preserve">'.self::xml((string) $value).'</t></is></c>';
                }
            }
            $xml .= '</row>';
        }
        $xml .= '</sheetData>';

        if ($this->merges) {
            $xml .= '<mergeCells count="'.count($this->merges).'">';
            foreach ($this->merges as $range) {
                $xml .= '<mergeCell ref="'.$range.'"/>';
            }
            $xml .= '</mergeCells>';
        }

        return $xml.'</worksheet>';
    }

    private function stylesXml(): string
    {
        $thin = '<left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right>'
            .'<top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/>';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="4">'
            .'<font><sz val="10"/><name val="Arial"/></font>'
            .'<font><b/><sz val="13"/><color rgb="FF990000"/><name val="Arial"/></font>'
            .'<font><b/><sz val="10"/><name val="Arial"/></font>'
            .'<font><i/><sz val="9"/><color rgb="FF666666"/><name val="Arial"/></font>'
            .'</fonts>'
            .'<fills count="5">'
            .'<fill><patternFill patternType="none"/></fill>'
            .'<fill><patternFill patternType="gray125"/></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFB6D7A8"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFF3F3F3"/><bgColor indexed="64"/></patternFill></fill>'
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFE6B8AF"/><bgColor indexed="64"/></patternFill></fill>'
            .'</fills>'
            .'<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>'.$thin.'</border></borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="8">'
            // 0 implicit
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            // 1 titlu
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            // 2 antet: bold, gri, centrat, text pe mai multe rânduri
            .'<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
            // 3 celulă cu chenar
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
            // 4 grup (echipă): bold, colorat, jos-centrat ca în tabelul de evidență
            .'<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="bottom" wrapText="1"/></xf>'
            // 5 marcat (prezent): verde
            .'<xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            // 6 total: bold, centrat
            .'<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>'
            // 7 notă
            .'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            .'</cellXfs>'
            .'</styleSheet>';
    }

    public static function ref(int $row, int $col): string
    {
        $letters = '';
        $n = $col + 1;
        while ($n > 0) {
            $mod = ($n - 1) % 26;
            $letters = chr(65 + $mod).$letters;
            $n = intdiv($n - 1, 26);
        }

        return $letters.($row + 1);
    }

    /** @return array{0: int, 1: int} */
    private static function parseRef(string $ref): array
    {
        preg_match('/^([A-Z]+)(\d+)$/', $ref, $m);
        $col = 0;
        foreach (str_split($m[1]) as $ch) {
            $col = $col * 26 + (ord($ch) - 64);
        }

        return [(int) $m[2] - 1, $col - 1];
    }

    private static function xml(string $value): string
    {
        // caractere de control invalide în XML 1.0 ar strica fișierul
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? '';

        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
