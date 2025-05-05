from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class Administrator(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    def __str__(self): return f"Administrator: {self.user.username}"

class Graph(models.Model):
    id = models.AutoField(primary_key=True)
    cipher_count = models.IntegerField()
    administrator = models.OneToOneField(Administrator, on_delete=models.CASCADE)
    def __str__(self): return f'Graph with {self.cipher_count} ciphers'

class Node(models.Model):
    name = models.CharField(max_length=255)
    graph = models.ForeignKey(Graph, related_name="nodes", on_delete=models.CASCADE)
    def __str__(self): return self.name

class Edge(models.Model):
    node1 = models.ForeignKey(Node, related_name="edges_from", on_delete=models.CASCADE)
    node2 = models.ForeignKey(Node, related_name="edges_to", on_delete=models.CASCADE)
    connection_type = models.CharField(max_length=255)
    def __str__(self): return f'{self.node1} -> {self.node2}'

class Reaction(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField()
    def __str__(self): return f"{self.id}: {self.description[:30]}"

class Cipher(models.Model):
    id = models.AutoField(primary_key=True)
    result = models.CharField(max_length=255, unique=True, db_index=True)
    def __str__(self): return self.result

class Study(models.Model):
    id = models.AutoField(primary_key=True)
    cipher = models.ForeignKey(Cipher, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    result = models.TextField()
    def __str__(self): return f'Study {self.id} by {self.user.username} for {self.cipher}'

class Association(models.Model):
    class FontWeight(models.IntegerChoices):
        THIN = 100, 'Thin'
        REGULAR = 400, 'Regular'
        SEMIBOLD = 600, 'Semi-Bold'
        BOLD = 700, 'Bold'
        BLACK = 900, 'Black'

    class FontStyle(models.TextChoices):
        NORMAL = 'normal', 'Прямой'
        ITALIC = 'italic', 'Курсив'
        OBLIQUE = 'oblique', 'Наклонный'

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='associations')
    cipher = models.ForeignKey(Cipher, on_delete=models.CASCADE, related_name='associations')
    reaction_description = models.TextField(blank=True, null=True, db_index=True)
    reaction_lemmas = models.TextField(blank=True, null=True, db_index=True)
    font_weight = models.IntegerField(choices=FontWeight.choices, default=FontWeight.REGULAR)
    font_style = models.CharField(max_length=10, choices=FontStyle.choices, default=FontStyle.NORMAL)
    letter_spacing = models.IntegerField(default=0)
    font_size = models.IntegerField(default=16)
    line_height = models.DecimalField(max_digits=3, decimal_places=1, default=1.5)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'cipher', 'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height'],
                name='unique_user_font_variation_reaction'
            )
        ]
        ordering = ['-created_at']

    @property
    def variation_details(self):
        style_display = self.get_font_style_display() if self.font_style != self.FontStyle.NORMAL else ''
        weight_display = f"Weight {self.get_font_weight_display()}"
        spacing_display = f"Spacing {self.letter_spacing}"
        size_display = f"Size {self.font_size}pt"
        leading_display = f"Leading {self.line_height}"
        parts = [self.cipher.result, weight_display, style_display, spacing_display, size_display, leading_display]
        return " ".join(filter(None, parts))

    def __str__(self):
        return f"Assoc. by {self.user.username} for {self.variation_details}"