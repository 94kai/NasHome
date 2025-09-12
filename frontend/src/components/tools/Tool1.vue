<template>
    <div>
        <h3>工具 1</h3>
        <p>这是一个计数器示例。</p>
        <button @click="count++">点击次数: {{ count }}</button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            count: 0
        };
    }
};
</script>
