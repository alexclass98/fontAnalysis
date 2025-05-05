from django.contrib import admin
# Убрали импорт get_user_model, так как мы больше не регистрируем User вручную здесь

# Импортируем ваши модели из models.py
from .models import (
    Administrator, Graph, Node, Edge, Reaction, Study, Cipher, Association
)

# Модель User регистрируется автоматически Django,
# поэтому строку ниже нужно УДАЛИТЬ или закомментировать:
# admin.site.register(User) # <--- УДАЛИТЬ ЭТУ СТРОКУ

# Регистрируем остальные ваши модели
admin.site.register(Administrator)
admin.site.register(Graph)
admin.site.register(Node)
admin.site.register(Edge)
admin.site.register(Reaction)
admin.site.register(Study)
admin.site.register(Cipher)
admin.site.register(Association)

# Если в будущем вы захотите КАСТОМИЗИРОВАТЬ админку для User,
# то вам нужно будет сначала импортировать get_user_model,
# затем User = get_user_model(),
# затем admin.site.unregister(User) (в блоке try-except),
# а потом admin.site.register(User, YourCustomUserAdmin)