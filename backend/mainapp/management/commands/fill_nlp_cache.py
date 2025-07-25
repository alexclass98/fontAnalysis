from django.core.management.base import BaseCommand
from mainapp.models import Association
from mainapp.nlp_processor import AdvancedTextProcessorBuilder, NLPProcessingDirector

class Command(BaseCommand):
    help = "Вычисляет и кэширует леммы, grouping_key и эмбеддинг для всех ассоциаций"

    def handle(self, *args, **options):
        nlp_builder = AdvancedTextProcessorBuilder()
        nlp_director = NLPProcessingDirector(builder=nlp_builder)
        total = Association.objects.count()
        for i, assoc in enumerate(Association.objects.all(), 1):
            if assoc.grouping_key_lemmas and assoc.text_embedding_vector:
                continue  # уже заполнено
            result = nlp_director.construct_custom_analysis(
                text=assoc.reaction_description,
                preprocess=True,
                tokenize_step=True,
                remove_stops=True,
                lemmatize_step=True,
                group_syns=False,
                gen_text_emb=True,
                grouping_strategy='lemmas'
            )
            assoc.reaction_lemmas = " ".join(result.lemmas)
            assoc.grouping_key_lemmas = result.grouping_key
            assoc.text_embedding_vector = result.text_embedding.tolist() if result.text_embedding is not None else None
            assoc.save(update_fields=['reaction_lemmas', 'grouping_key_lemmas', 'text_embedding_vector'])
            if i % 10 == 0:
                self.stdout.write(f"{i}/{total} обработано")
        self.stdout.write("Готово!") 