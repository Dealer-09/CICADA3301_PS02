document.addEventListener('DOMContentLoaded', () => {
    const tasksContainer = document.getElementById('tasks-container');

    const sampleTasks = [
        { "id": "1", "name": "Open VS Code", "subtitle": "Code editor", "icon": "💻", "type": "app", "target": "code", "category": "Apps" },
        { "id": "2", "name": "Open GitHub", "subtitle": "github.com", "icon": "🌐", "type": "website", "target": "https://github.com", "category": "Websites" },
        { "id": "3", "name": "Start a 25-min timer", "subtitle": "Pomodoro", "icon": "⏲️", "type": "timer", "target": 25, "category": "Timers" },
        { "id": "4", "name": "List current directory", "subtitle": "ls -la", "icon": "셸", "type": "command", "target": "ls -la", "category": "Commands" }
    ];

    function renderTasks(tasks) {
        tasksContainer.innerHTML = '';
        const categories = {};
        tasks.forEach(task => {
            if (!categories[task.category]) {
                categories[task.category] = [];
            }
            categories[task.category].push(task);
        });

        for (const category in categories) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'task-category';
            
            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = category;
            categoryDiv.appendChild(categoryTitle);

            categories[category].forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = 'task-item';
                taskItem.innerHTML = `
                    <div class="task-icon">${task.icon}</div>
                    <div class="task-details">
                        <div class="task-name">${task.name}</div>
                        <div class="task-subtitle">${task.subtitle}</div>
                    </div>
                `;
                taskItem.addEventListener('click', () => {
                    window.electronAPI.executeTask(task);
                });
                categoryDiv.appendChild(taskItem);
            });
            tasksContainer.appendChild(categoryDiv);
        }
    }

    renderTasks(sampleTasks);
});
