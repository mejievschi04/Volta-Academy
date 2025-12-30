<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CreateTestUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:create-test-user';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Create admin user
        $admin = \App\Models\User::firstOrCreate(
            ['email' => 'admin@volta.academy'],
            [
                'name' => 'Administrator',
                'password' => \Illuminate\Support\Facades\Hash::make('volta 2025'),
                'role' => 'admin',
                'level' => 1,
                'points' => 0,
            ]
        );
        
        // Update password if admin already exists
        if ($admin->wasRecentlyCreated === false) {
            $admin->update(['password' => \Illuminate\Support\Facades\Hash::make('volta 2025')]);
        }
        
        $this->info('Admin user created/updated:');
        $this->info('Email: admin@volta.academy');
        $this->info('Password: volta 2025');
        $this->info('Role: admin');
    }
}
